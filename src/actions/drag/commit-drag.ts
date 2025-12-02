import { RawValue } from "@semio/utils";
import type { AnimationData } from "../../store-types";
import {
  applyTrackDiffsToTrack,
  computeTrackDiffsForDrag,
} from "../../functions/apply-drag-deltas";
import { cloneTransitionValue, cloneTransitions } from "../../utils/clone-transitions";
import type { SelectionState, Track } from "../../types";

interface MarkerContext {
  attributePath?: string[];
  bounds?: { min: number; max: number };
}

const buildMarkerContextLookup = (state: AnimationData): Map<string, MarkerContext> => {
  const lookup = new Map<string, MarkerContext>();
  const rowIds = Object.keys(state.derivedSnapshot?.rows ?? {});
  for (const rowId of rowIds) {
    const computed = state.derivedSnapshot?.rows?.[rowId]?.computed;
    if (!computed) continue;
    const bounds = computed.verticalBounds;

    for (const frame of computed.virtualFrames) {
      for (const point of frame.points) {
        const key = `${point.trackId}:${point.id}`;
        if (lookup.has(key)) continue;
        lookup.set(key, {
          attributePath: point.attribute ? [point.attribute] : undefined,
          bounds,
        });
      }
    }
  }
  return lookup;
};

/**
 * If two keypoints land on the same stamp in the same track, keep the dragged/anchor id and
 * drop the others. This mirrors the "overwrite" expectation when a marker is dragged onto another.
 */
const collapseCoincidentKeypoints = (
  track: Track<RawValue>,
  trackId: string,
  keepId: string,
  selection: SelectionState,
): void => {
  const keeper = track.points.find((p) => p.id === keepId);
  if (!keeper) return;

  const EPSILON = 1e-6;

  const removedIds: string[] = [];
  const filtered = track.points.filter((point) => {
    if (point.id === keepId) return true;
    if (Math.abs(point.stamp - keeper.stamp) < EPSILON) {
      removedIds.push(point.id);
      return false;
    }
    return true;
  });

  if (removedIds.length === 0) return;

  track.points.splice(0, track.points.length, ...filtered);

  const selectionSet = selection.keypoints.get(trackId);
  if (selectionSet) {
    removedIds.forEach((id) => selectionSet.delete(id));
    if (selectionSet.size === 0) {
      selection.keypoints.delete(trackId);
    }
  }
};

/**
 * Commit the current drag operation, applying all changes.
 * This uses the ID-based architecture to avoid stale data issues.
 *
 * @param state - The animation state to modify
 */
export function commitDrag(state: AnimationData): void {
  const dragState = state.dragState;
  if (!dragState) {
    return;
  }

  const selection = state.selectionState;
  if (!selection.instanceId || selection.instanceId !== dragState.instanceId) {
    state.dragState = undefined;
    return;
  }

  const anchorTrackSelection = selection.keypoints.get(dragState.anchor.trackId);
  const isHandleDrag = Boolean(dragState.activeHandleId);
  if (!anchorTrackSelection?.has(dragState.anchor.keypointId) && !isHandleDrag) {
    state.dragState = undefined;
    return;
  }

  const rawStampDelta =
    dragState.axis === "horizontal" || dragState.axis === "both"
      ? (dragState.stampDelta?.snapped ?? dragState.stampDelta?.raw)
      : undefined;
  const stampDelta =
    typeof rawStampDelta === "number" && Number.isFinite(rawStampDelta) ? rawStampDelta : undefined;

  const rawValueDelta =
    dragState.axis === "vertical" || dragState.axis === "both"
      ? dragState.normalizedValueDelta
      : undefined;

  const normalizedValueDelta =
    typeof rawValueDelta === "number" && Number.isFinite(rawValueDelta) ? rawValueDelta : undefined;

  const hasVerticalDelta = normalizedValueDelta !== undefined;
  const hasHorizontalDelta = typeof stampDelta === "number";

  if (!hasHorizontalDelta && !hasVerticalDelta) {
    const handleDiffs = dragState.handleDiffs;
    if (handleDiffs && Object.keys(handleDiffs).length > 0) {
      Object.entries(handleDiffs).forEach(([keypointId, diff]) => {
        if (!diff.in && !diff.out) return;
        const track = Object.values(state.tracks).find((t) =>
          t.points.some((p) => p.id === keypointId),
        );
        if (!track) return;
        const point = track.points.find((p) => p.id === keypointId);
        if (!point) return;
        point.transitions = point.transitions ? { ...point.transitions } : {};
        if (diff.out) {
          point.transitions.out = cloneTransitionValue(diff.out);
        }
        if (diff.in) {
          point.transitions.in = cloneTransitionValue(diff.in);
        }
      });
    }
    state.dragState = undefined;
    return;
  }

  const markerContexts = hasVerticalDelta ? buildMarkerContextLookup(state) : undefined;
  const attributePathByTrack = new Map<string, string[] | undefined>();
  const boundsByTrack = new Map<string, { min: number; max: number } | undefined>();
  markerContexts?.forEach((context, key) => {
    const [trackId] = key.split(":");
    if (!attributePathByTrack.has(trackId) && context?.attributePath) {
      attributePathByTrack.set(trackId, context.attributePath);
    }
    if (!boundsByTrack.has(trackId) && context?.bounds) {
      boundsByTrack.set(trackId, context.bounds);
    }
  });

  for (const [trackId] of selection.keypoints.entries()) {
    const track = state.tracks[trackId];
    if (!track) continue;
    const snapshotPoints =
      dragState.trackSnapshots?.[trackId]?.points ??
      track.points.map((point) => ({
        ...point,
        value: structuredClone(point.value),
        transitions: cloneTransitions(point.transitions),
      }));

    const diffs = computeTrackDiffsForDrag({
      trackId,
      trackPoints: track.points,
      snapshotPoints,
      dragState,
      selection,
      bounds: hasVerticalDelta ? boundsByTrack.get(trackId) : undefined,
      attributePath: attributePathByTrack.get(trackId) ?? dragState.anchor.attributePath,
    });

    if (diffs.length === 0) {
      continue;
    }

    applyTrackDiffsToTrack(track, diffs);
  }

  const handleDiffs = dragState.handleDiffs;
  if (handleDiffs && Object.keys(handleDiffs).length > 0) {
    Object.entries(handleDiffs).forEach(([keypointId, diff]) => {
      if (!diff.in && !diff.out) return;
      const track = Object.values(state.tracks).find((t) =>
        t.points.some((p) => p.id === keypointId),
      );
      if (!track) return;
      const point = track.points.find((p) => p.id === keypointId);
      if (!point) return;
      point.transitions = point.transitions ? { ...point.transitions } : {};
      if (diff.out) {
        point.transitions.out = cloneTransitionValue(diff.out);
      }
      if (diff.in) {
        point.transitions.in = cloneTransitionValue(diff.in);
      }
    });
  }

  // If the dragged marker lands on the same stamp as another marker in the same track,
  // drop the existing marker and keep the dragged one.
  if (dragState.anchor?.trackId && dragState.anchor?.keypointId) {
    const track = state.tracks[dragState.anchor.trackId];
    if (track) {
      collapseCoincidentKeypoints(
        track as Track<RawValue>,
        dragState.anchor.trackId,
        dragState.anchor.keypointId,
        selection,
      );
    }
  }

  state.dragState = undefined;
}
