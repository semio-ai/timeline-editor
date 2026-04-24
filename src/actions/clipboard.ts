import { produce } from "immer";
import {
  applyTrackDiffOpsToTrack,
  computeLocalStamp,
  computeWorldStamp,
} from "../functions";
import type {
  AnimationData,
  AnimationStoreGetter,
  AnimationStoreSetter,
} from "../store-types";
import type { SourceRow } from "../types";
import type { TrackDiffOp } from "../types/util/diff";

/**
 * Set of track IDs currently flagged as locked across all source rows.
 * Used to filter out locked tracks from any edit operation before it reaches
 * the diff pipeline.
 */
function getLockedTrackIds(sourceRows: Record<string, SourceRow>): Set<string> {
  const locked = new Set<string>();
  Object.values(sourceRows).forEach((row) =>
    row.data.forEach((d) => {
      if (d.locked) locked.add(d.trackId);
    }),
  );
  return locked;
}

interface InstanceTiming {
  timescale: number;
  offset: number;
}

function resolveInstanceTiming(
  state: AnimationData,
  instanceId: string | null,
): InstanceTiming {
  let timescale = 1;
  let offset = 0;
  if (!instanceId) return { timescale, offset };
  for (const namespace of Object.values(state.namespaces)) {
    const instance = namespace.animationInstances[instanceId];
    if (instance) {
      timescale = instance.settings.timescale ?? 1;
      if (!Number.isFinite(timescale) || timescale === 0) timescale = 1;
      offset = instance.settings.offset ?? 0;
      if (!Number.isFinite(offset)) offset = 0;
      break;
    }
  }
  return { timescale, offset };
}

export function copySelection(set: AnimationStoreSetter, get: AnimationStoreGetter): void {
  const state = get();
  const { keypoints: selectedMap, instanceId } = state.selectionState;
  if (selectedMap.size === 0) return;

  const { timescale, offset } = resolveInstanceTiming(state, instanceId);

  // Collect keypoints and convert to world-time stamps
  const trackEntries: {
    key: string;
    worldStamps: { stamp: number; value: any; transitions: any }[];
  }[] = [];
  let minWorldStamp = Infinity;

  const sortedTrackKeys = Array.from(selectedMap.keys()).sort();
  for (const trackKey of sortedTrackKeys) {
    const keypointIds = selectedMap.get(trackKey);
    if (!keypointIds || keypointIds.size === 0) continue;
    const track = state.tracks[trackKey];
    if (!track) continue;

    const collected: { stamp: number; value: any; transitions: any }[] = [];
    for (const point of track.points) {
      if (!keypointIds.has(point.id)) continue;
      const worldStamp = computeWorldStamp(point.stamp, timescale, offset);
      if (worldStamp < minWorldStamp) minWorldStamp = worldStamp;
      collected.push({
        stamp: worldStamp,
        value: point.value,
        transitions: point.transitions ? structuredClone(point.transitions) : undefined,
      });
    }
    if (collected.length > 0) {
      trackEntries.push({ key: trackKey, worldStamps: collected });
    }
  }

  if (trackEntries.length === 0) return;

  // Convert to offset-from-anchor format. Stamps are stored relative to
  // the earliest selected keypoint across all tracks, so paste can be
  // anchored to an arbitrary playhead position without losing the inter-
  // keypoint spacing or the relative ordering across tracks. World-time
  // is used (not local) so a paste into an instance with a different
  // timescale/offset still preserves the *real-time* shape of the copy.
  const clipboardTracks = trackEntries.map((entry, idx) => ({
    sourceTrackKey: entry.key,
    trackIndex: idx,
    keypoints: entry.worldStamps.map((kp) => ({
      stampOffset: kp.stamp - minWorldStamp,
      value: kp.value,
      transitions: kp.transitions,
    })),
  }));

  set({ clipboard: { tracks: clipboardTracks, instanceId } });
}

export function cutSelection(set: AnimationStoreSetter, get: AnimationStoreGetter): void {
  // Copy then delete. Delete respects locked tracks.
  copySelection(set, get);
  deleteSelection(set, get);
}

export function pasteAtStamp(
  set: AnimationStoreSetter,
  get: AnimationStoreGetter,
  worldStamp: number,
): void {
  const lockedTrackIds = getLockedTrackIds(get().instancedTrackSources);
  set(
    produce((state: AnimationData): void => {
      const clipboard = state.clipboard;
      if (!clipboard || clipboard.tracks.length === 0) return;

      // Determine if we're pasting to selected tracks (cross-track) or source tracks
      const selectedTrackKeys = Array.from(state.selectionState.keypoints.keys()).sort();
      const useCrossTrackPaste = selectedTrackKeys.length > 0;

      const { instanceId } = state.selectionState;
      const { timescale, offset } = resolveInstanceTiming(state, instanceId);

      const newSelection = new Map<string, Set<string>>();

      for (const clipTrack of clipboard.tracks) {
        // Resolve target track
        // TODO(animation-usability): cross-instance paste — map by
        // animatable path/id rather than positional index so a copy from
        // instance A's "scale" lands on instance B's "scale" when the
        // selection contains an arbitrary set of tracks. The current
        // index mapping silently writes to the wrong animatable when the
        // selection ordering doesn't line up with the clipboard.
        let targetTrackKey: string;
        if (useCrossTrackPaste) {
          // Map by index: clipboard trackIndex → selected track at same index
          if (clipTrack.trackIndex >= selectedTrackKeys.length) continue;
          targetTrackKey = selectedTrackKeys[clipTrack.trackIndex];
        } else {
          targetTrackKey = clipTrack.sourceTrackKey;
        }

        // Skip locked tracks — no edits allowed
        if (lockedTrackIds.has(targetTrackKey)) continue;

        const track = state.tracks[targetTrackKey];
        if (!track) continue;

        // Build diff ops: delete coincident points, then insert new ones.
        const diffs: TrackDiffOp[] = [];
        const trackSelection = new Set<string>();

        for (const clipKp of clipTrack.keypoints) {
          const targetWorldStamp = worldStamp + clipKp.stampOffset;
          const localStamp = computeLocalStamp(targetWorldStamp, timescale, offset);

          // Delete existing keypoints within 1ms of paste stamp (replace behavior)
          track.points.forEach((p) => {
            if (Math.abs(p.stamp - localStamp) <= 1) {
              diffs.push({ type: "deleteKeypoint", trackId: targetTrackKey, keypointId: p.id });
            }
          });

          const newId = crypto.randomUUID();
          diffs.push({
            type: "insertKeypoint",
            trackId: targetTrackKey,
            keypoint: {
              id: newId,
              stamp: localStamp,
              value: clipKp.value,
              transitions: clipKp.transitions ?? undefined,
            },
          });
          trackSelection.add(newId);
        }

        applyTrackDiffOpsToTrack(track, diffs);
        // Re-sort by stamp after insertions
        track.points.sort((a, b) => a.stamp - b.stamp);

        if (trackSelection.size > 0) {
          newSelection.set(targetTrackKey, trackSelection);
        }
      }

      // Select the newly pasted keypoints
      if (newSelection.size > 0) {
        state.selectionState = {
          ...state.selectionState,
          keypoints: newSelection,
          reference: null,
        };
      }
    }),
  );
}

export function deleteSelection(set: AnimationStoreSetter, get: AnimationStoreGetter): void {
  const lockedTrackIds = getLockedTrackIds(get().instancedTrackSources);
  set(
    produce((state: AnimationData): void => {
      const selected = state.selectionState.keypoints;
      if (selected.size === 0) return;

      // Group deletes by track so we can apply as a single diff batch per track
      const diffsByTrack = new Map<string, TrackDiffOp[]>();
      selected.forEach((keypointIds, trackId) => {
        if (lockedTrackIds.has(trackId)) return;
        const list: TrackDiffOp[] = [];
        keypointIds.forEach((keypointId) => {
          list.push({ type: "deleteKeypoint", trackId, keypointId });
        });
        if (list.length > 0) diffsByTrack.set(trackId, list);
      });

      diffsByTrack.forEach((diffs, trackId) => {
        const track = state.tracks[trackId];
        if (!track) return;
        applyTrackDiffOpsToTrack(track, diffs);
      });

      // Clear selection for tracks whose keypoints were removed; preserve
      // selection entries for locked tracks (their keypoints still exist).
      const nextSelection = new Map<string, Set<string>>();
      selected.forEach((keypointIds, trackId) => {
        if (lockedTrackIds.has(trackId)) {
          nextSelection.set(trackId, new Set(keypointIds));
        }
      });
      state.selectionState = {
        ...state.selectionState,
        keypoints: nextSelection,
        reference: null,
      };
    }),
  );
}
