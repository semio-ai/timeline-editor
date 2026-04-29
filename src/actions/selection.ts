import { produce } from "immer";
import { uniq } from "lodash";
import { usePlayerStore } from "@semio/utils";
import { createEmptySelectionState } from "../functions/selection-state-manager";
import type {
  AnimationData,
  AnimationStoreGetter,
  AnimationStoreSetter,
  EntityAnimationState,
} from "../store-types";

export function selectAll(set: AnimationStoreSetter): void {
  set(
    produce((state: AnimationData): void => {
      const { instanceId } = state.selectionState;
      const newKeypoints = new Map<string, Set<string>>();
      for (const [trackKey, track] of Object.entries(state.tracks)) {
        const belongsToInstance =
          !instanceId ||
          Object.values(state.instancedTrackSources).some((row) =>
            row.data.some((d) => d.trackId === trackKey && d.instanceId === instanceId),
          );
        if (belongsToInstance && track.points.length > 0) {
          newKeypoints.set(trackKey, new Set(track.points.map((p) => p.id)));
        }
      }
      state.selectionState.keypoints = newKeypoints;
    }),
  );
}

export function selectAllInTracks(set: AnimationStoreSetter, trackKeys: string[]): void {
  set(
    produce((state: AnimationData): void => {
      const newKeypoints = new Map<string, Set<string>>();
      for (const trackKey of trackKeys) {
        const track = state.tracks[trackKey];
        if (track && track.points.length > 0) {
          newKeypoints.set(trackKey, new Set(track.points.map((p) => p.id)));
        }
      }
      state.selectionState.keypoints = newKeypoints;
    }),
  );
}

export function focusSelectionInstance(set: AnimationStoreSetter, instanceId: string): void {
  // Partial guard during playback: keep the editor's selection focus
  // updating so users can still inspect a different instance's keypoints,
  // but skip the entityStates mutation that would mid-frame retarget the
  // bridge. Same rule as setEntityControlMode — the entity↔active-instance
  // pairing must not change during playback.
  const isPlaying = Boolean(usePlayerStore.getState().player?.running);

  set((state: AnimationData) => {
    // Find the entity that owns this animation instance so the persisted
    // per-entity active-instance can be updated alongside the selection focus.
    // Without this sync, the controls sidebar's active-animation dropdown
    // (which reads `entityStates[id].activeInstanceId` via
    // `activeEntityContext`) goes stale when the user activates a different
    // instance via a track row click or canvas interaction — the timeline
    // updates but the dropdown doesn't.
    let owningEntityId: string | null = null;
    for (const namespaceId of Object.keys(state.namespaces)) {
      if (state.namespaces[namespaceId].animationInstances?.[instanceId]) {
        owningEntityId = namespaceId.split("@")[0];
        break;
      }
    }

    const result: Partial<AnimationData> = {
      selectionState: createEmptySelectionState(instanceId),
    };

    if (owningEntityId && !isPlaying) {
      const currentEntityState = state.entityStates[owningEntityId];
      if (
        currentEntityState?.controlMode === "animation" &&
        currentEntityState.activeInstanceId !== instanceId
      ) {
        result.entityStates = {
          ...state.entityStates,
          [owningEntityId]: {
            ...currentEntityState,
            activeInstanceId: instanceId,
          },
        };
      }
    }

    return result;
  });
}

export function setActiveEntity(
  set: AnimationStoreSetter,
  get: AnimationStoreGetter,
  entityId: string | null,
): void {
  const current = get();
  if (current.activeEntityId === entityId) return;
  set((state: AnimationData) => {
    if (entityId === null) {
      return {
        activeEntityId: null,
        selectionState: createEmptySelectionState(null),
      };
    }
    const entityState = state.entityStates[entityId];
    const instanceId =
      entityState?.controlMode === "animation" ? (entityState.activeInstanceId ?? null) : null;
    return {
      activeEntityId: entityId,
      selectionState: createEmptySelectionState(instanceId),
    };
  });
}

export function setEntityControlMode(
  set: AnimationStoreSetter,
  get: AnimationStoreGetter,
  entityId: string,
  mode: "direct" | "animation",
  instanceId?: string,
): void {
  // Guard: don't swap which animation instance drives an entity during
  // playback. See setEntityControlModeAction in the studio package for the
  // same rule applied to the project-doc writer.
  if (usePlayerStore.getState().player?.running) return;

  const currentEntityState = get().entityStates[entityId];
  const resolvedInstanceId = mode === "animation" ? (instanceId ?? null) : null;
  if (
    currentEntityState?.controlMode === mode &&
    currentEntityState?.activeInstanceId === resolvedInstanceId
  ) {
    return;
  }
  set((state: AnimationData) => {
    const newEntityStates = {
      ...state.entityStates,
      [entityId]: {
        controlMode: mode,
        activeInstanceId: mode === "animation" ? (instanceId ?? null) : null,
      },
    };

    // If this is the active entity, also update selection instance
    if (state.activeEntityId === entityId) {
      const newInstanceId = mode === "animation" ? (instanceId ?? null) : null;
      return {
        entityStates: newEntityStates,
        selectionState: createEmptySelectionState(newInstanceId),
      };
    }

    return { entityStates: newEntityStates };
  });
}

export function setEntityStates(
  set: AnimationStoreSetter,
  states: Record<string, EntityAnimationState>,
): void {
  set((state: AnimationData) => ({
    entityStates: { ...state.entityStates, ...states },
  }));
}

export function setEmphasis(set: AnimationStoreSetter, rowId: string | null): void {
  set(() => ({ emphasisRowId: rowId }));
}

export function selectTrack(
  set: AnimationStoreSetter,
  rowId: string,
  trackIds: string[],
): void {
  set(
    produce((state: AnimationData) => {
      const newKeypoints = new Map<string, Set<string>>();
      trackIds.forEach((id) => newKeypoints.set(id, new Set<string>()));
      state.selectionState.keypoints = newKeypoints;
      state.selectionState.reference = { rowId, markerId: rowId };
    }),
  );
}

export function toggleTrackInSelection(
  set: AnimationStoreSetter,
  rowId: string,
  trackIds: string[],
): void {
  set(
    produce((state: AnimationData) => {
      // If all trackIds are already in keypoints, remove them; otherwise add them
      const allPresent = trackIds.every((id) => state.selectionState.keypoints.has(id));
      if (allPresent) {
        trackIds.forEach((id) => state.selectionState.keypoints.delete(id));
      } else {
        trackIds.forEach((id) => {
          if (!state.selectionState.keypoints.has(id)) {
            state.selectionState.keypoints.set(id, new Set<string>());
          }
        });
      }
      state.selectionState.reference = { rowId, markerId: rowId };
    }),
  );
}

export function rangeSelectTracks(
  set: AnimationStoreSetter,
  fromRowId: string,
  toRowId: string,
): void {
  set(
    produce((state: AnimationData) => {
      const flat = state.sourceRowIds.flat;
      const fromIndex = flat.indexOf(fromRowId);
      const toIndex = flat.indexOf(toRowId);
      if (fromIndex === -1 || toIndex === -1) return;

      const start = Math.min(fromIndex, toIndex);
      const end = Math.max(fromIndex, toIndex);
      const rangeIds = flat.slice(start, end + 1);

      // Resolve each row's trackIds from instancedTrackSources
      const newKeypoints = new Map<string, Set<string>>();
      rangeIds.forEach((id) => {
        const row = state.instancedTrackSources[id];
        if (row) {
          const rowTrackIds = uniq(row.data.map((d) => d.trackId));
          rowTrackIds.forEach((tid) => newKeypoints.set(tid, new Set<string>()));
        }
      });
      state.selectionState.keypoints = newKeypoints;
    }),
  );
}
