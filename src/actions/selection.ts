import { namespaceEntity } from "@semio/data";
import { produce } from "immer";
import { uniq } from "lodash";
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

/**
 * Resolves what the editor's "actively edited instance" should be for the
 * given proposed-active entity, given an entityStates record. Encodes the
 * derivation rule from `row-edit-state.ts`:
 * `entityStates[activeEntityId]?.activeInstanceId ?? null`. Used by every
 * writer to keep `selectionState.instanceId` in sync.
 */
function deriveSelectionInstanceId(
  entityStates: AnimationData["entityStates"],
  activeEntityId: string | null,
): string | null {
  if (activeEntityId === null) return null;
  return entityStates[activeEntityId]?.activeInstanceId ?? null;
}

/**
 * Look up the entity that owns a given animation instance by walking the
 * namespaces map. Returns `null` when no namespace contains the instance —
 * caller should treat that as "no-op".
 */
function findOwningEntityForInstance(
  namespaces: AnimationData["namespaces"],
  instanceId: string,
): string | null {
  for (const namespaceId of Object.keys(namespaces)) {
    if (namespaces[namespaceId].animationInstances?.[instanceId]) {
      return namespaceEntity(namespaceId);
    }
  }
  return null;
}

/**
 * Click-to-edit entry point. Called from canvas/track-list track clicks.
 *
 * Unified semantics (kept consistent with the model in `row-edit-state.ts`):
 *
 * - Always switches `activeEntityId` to the clicked instance's owning
 *   entity. Entity focus follows clicks, even during playback (per the
 *   user's design rule that entity switching is allowed mid-playback).
 * - When NOT playing: also updates `entityStates[owningEntity].activeInstanceId`
 *   to the clicked instance — this is the "user changed which animation is
 *   active for this entity" mutation. Gated during playback.
 * - `selectionState.instanceId` is then mirrored from the resulting
 *   `entityStates[activeEntityId].activeInstanceId`. During playback, this
 *   means clicking a non-active instance switches focus but the mirror
 *   stays at the entity's existing active driver — the click effectively
 *   moves focus without changing what's edited.
 */
export function focusSelectionInstance(
  set: AnimationStoreSetter,
  get: AnimationStoreGetter,
  instanceId: string,
): void {
  const isPlaying = Boolean(get().playerStore.getState().player?.running);

  set((state: AnimationData) => {
    const owningEntityId = findOwningEntityForInstance(state.namespaces, instanceId);
    if (!owningEntityId) return {};

    let nextEntityStates = state.entityStates;
    if (!isPlaying) {
      const currentEntityState = state.entityStates[owningEntityId];
      if (currentEntityState?.activeInstanceId !== instanceId) {
        nextEntityStates = {
          ...state.entityStates,
          [owningEntityId]: {
            controlMode: currentEntityState?.controlMode ?? "animation",
            activeInstanceId: instanceId,
          },
        };
      }
    }

    const nextSelectionInstanceId = deriveSelectionInstanceId(nextEntityStates, owningEntityId);

    const result: Partial<AnimationData> = {
      activeEntityId: owningEntityId,
      selectionState: createEmptySelectionState(nextSelectionInstanceId),
    };
    if (nextEntityStates !== state.entityStates) {
      result.entityStates = nextEntityStates;
    }
    return result;
  });
}

/**
 * Set the editor's focused entity. Called from the entity dropdown and 3D
 * scene clicks. `selectionState.instanceId` is mirrored from the new
 * entity's active driver — keeps the unified contract.
 */
export function setActiveEntity(
  set: AnimationStoreSetter,
  get: AnimationStoreGetter,
  entityId: string | null,
): void {
  const current = get();
  if (current.activeEntityId === entityId) return;
  set((state: AnimationData) => {
    const nextSelectionInstanceId = deriveSelectionInstanceId(state.entityStates, entityId);
    return {
      activeEntityId: entityId,
      selectionState: createEmptySelectionState(nextSelectionInstanceId),
    };
  });
}

/**
 * Set per-entity control mode and (optionally) active instance. Called from
 * the controls sidebar dropdown. When the modified entity is the focused
 * one, mirrors `selectionState.instanceId` to the new active. Pairing
 * changes are gated during playback.
 */
export function setEntityControlMode(
  set: AnimationStoreSetter,
  get: AnimationStoreGetter,
  entityId: string,
  mode: "direct" | "animation",
  instanceId?: string,
): void {
  if (get().playerStore.getState().player?.running) return;

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
        activeInstanceId: resolvedInstanceId,
      },
    };

    // If this is the focused entity, mirror selectionState.instanceId so
    // the unified "actively edited" derivation stays in sync.
    if (state.activeEntityId === entityId) {
      return {
        entityStates: newEntityStates,
        selectionState: createEmptySelectionState(resolvedInstanceId),
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
