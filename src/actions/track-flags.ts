import { produce } from "immer";
import { collectSourceTracks, computeUpdatedSources } from "../functions";
import { GROUP_TYPES } from "../constants";
import type {
  AnimationData,
  AnimationStoreGetter,
  AnimationPreferencesPatch,
  AnimationStoreSetter,
} from "../store-types";
import type { Source, SourceGroup } from "../types";

/**
 * For a given source row id, resolve every leaf track id underneath it.
 * Used by the per-view visibility toggle so checking "hide" on a group
 * collapses to hiding all of its descendant tracks for that view.
 */
export function resolveTrackIdsForVisibilityUpdate(
  globalSourceTree: AnimationData["globalSourceTree"],
  sourceId: string,
): string[] {
  const trackIds = new Set<string>();

  const visit = (sources: Source[]): void => {
    sources.forEach((source) => {
      if (GROUP_TYPES.has(source.type)) {
        const sourceGroup = source as SourceGroup;
        if (source.id === sourceId) {
          collectSourceTracks([source]).forEach((track) => {
            trackIds.add(track.id);
          });
          return;
        }
        visit(sourceGroup.children);
        return;
      }
      if (source.id === sourceId) {
        trackIds.add(source.id);
      }
    });
  };

  visit(globalSourceTree);

  return Array.from(trackIds);
}

export function updateViewTrackVisibility(
  set: AnimationStoreSetter,
  viewId: string,
  updates: Record<string, { hidden?: boolean }>,
): void {
  set(
    produce((state: AnimationData) => {
      const view = state.editorViews[viewId];
      if (!view) return;

      const hiddenSet = new Set(view.hiddenSourceTrackIds ?? []);
      Object.entries(updates).forEach(([sourceId, update]) => {
        if (update.hidden === undefined) return;
        const resolvedTrackIds = resolveTrackIdsForVisibilityUpdate(
          state.globalSourceTree,
          sourceId,
        );
        resolvedTrackIds.forEach((trackId) => {
          if (update.hidden) {
            hiddenSet.add(trackId);
          } else {
            hiddenSet.delete(trackId);
          }
        });
      });

      state.editorViews[viewId] = {
        ...view,
        hiddenSourceTrackIds: Array.from(hiddenSet),
      };
    }),
  );
}

export function setTracksMuted(
  set: AnimationStoreSetter,
  sourceIds: string | string[],
  muted: boolean,
): void {
  const ids = Array.isArray(sourceIds) ? sourceIds : [sourceIds];
  set(
    produce((state: AnimationData): void => {
      const updates: Record<string, { muted?: boolean }> = {};
      ids.forEach((sourceId) => {
        updates[sourceId] = { muted };
      });
      // Mute is purely the user's per-track toggle. The "at most one
      // track per animatable can drive the rig" rule is enforced
      // structurally by the entity's devices playing only its active
      // animation instance (Studio's `arora-subscription.ts`). Tracks in
      // non-active instances do not need to be muted; they do not play.
      state.globalSourceTree = computeUpdatedSources(state.globalSourceTree, updates);
    }),
  );
}

export function setTracksVisible(
  set: AnimationStoreSetter,
  sourceIds: string | string[],
  visible: boolean,
): void {
  const ids = Array.isArray(sourceIds) ? sourceIds : [sourceIds];
  set(
    produce((state: AnimationData): void => {
      const updates: Record<string, { visible?: boolean }> = {};
      ids.forEach((id) => {
        updates[id] = { visible };
      });
      state.globalSourceTree = computeUpdatedSources(state.globalSourceTree, updates);
    }),
  );
}

/**
 * Set the document-permission `readonly` flag on a list of source ids.
 * Distinct from `setTracksLocked`: callers are studio-side load paths
 * propagating the current user's edit permission, not the user toggling a
 * lock from the UI.
 *
 * Idempotent: skips the `set()` entirely when every requested id already
 * carries the desired flag value. Critical for the studio-side reactive
 * wiring, which subscribes to `globalSourceTree` and would otherwise loop
 * infinitely (subscription fires → action writes a new tree → subscription
 * fires again).
 */
export function setSourcesReadonly(
  set: AnimationStoreSetter,
  get: AnimationStoreGetter,
  sourceIds: string | string[],
  readonly: boolean,
): void {
  const ids = Array.isArray(sourceIds) ? sourceIds : [sourceIds];
  if (ids.length === 0) return;

  const currentById = new Map<string, boolean>();
  collectSourceTracks(get().globalSourceTree).forEach((track) => {
    if (ids.includes(track.id)) {
      currentById.set(track.id, track.readonly === true);
    }
  });
  // Only operate on ids that exist in the tree AND whose current value
  // differs from the requested value. If none, do not write.
  const idsToUpdate = ids.filter((id) => {
    const current = currentById.get(id);
    return current !== undefined && current !== readonly;
  });
  if (idsToUpdate.length === 0) return;

  set(
    produce((state: AnimationData): void => {
      const updates: Record<string, { readonly?: boolean }> = {};
      idsToUpdate.forEach((id) => {
        updates[id] = { readonly };
      });
      state.globalSourceTree = computeUpdatedSources(state.globalSourceTree, updates);
    }),
  );
}

/**
 * Mark every track belonging to a given animation as readonly (or clear it).
 * Used by studio-side wiring when an asset's permissions change so the
 * editor reflects the new edit-capability without needing to know about
 * individual track ids.
 *
 * Maintains both:
 *   - per-track `readonly` flags on existing tracks in `globalSourceTree`
 *     (used by per-track edit gates in `getNonEditableTrackIds`)
 *   - the animation-level `readonlyAnimations` map (used by gates that
 *     operate on the animation as a whole — `createTrack` for the case
 *     where the new track doesn't exist yet, and the "Add Track" button
 *     on empty animations that have no per-track flag to consult)
 *
 * Both branches are idempotent.
 */
export function setAnimationReadonly(
  set: AnimationStoreSetter,
  get: AnimationStoreGetter,
  animationId: string,
  readonly: boolean,
): void {
  const tracks = collectSourceTracks(get().globalSourceTree);
  const ids = tracks.filter((track) => track.animationId === animationId).map((track) => track.id);
  if (ids.length > 0) {
    setSourcesReadonly(set, get, ids, readonly);
  }

  const current = get().readonlyAnimations[animationId] === true;
  if (current === readonly) return;
  set(
    produce((state: AnimationData): void => {
      if (readonly) {
        state.readonlyAnimations[animationId] = true;
      } else {
        delete state.readonlyAnimations[animationId];
      }
    }),
  );
}

export function setTracksLocked(
  set: AnimationStoreSetter,
  get: AnimationStoreGetter,
  sourceIds: string | string[],
  locked: boolean,
): void {
  // Refuse to change the user-toggle lock on permission-locked tracks. The
  // visual effect is identical (both render as locked), but readonly cannot
  // be cleared from the editor — only by changing document permissions.
  const requested = Array.isArray(sourceIds) ? sourceIds : [sourceIds];
  const tracks = collectSourceTracks(get().globalSourceTree);
  const readonlyIds = new Set(
    tracks.filter((track) => track.readonly === true).map((track) => track.id),
  );
  const ids = requested.filter((id) => !readonlyIds.has(id));
  if (ids.length === 0) return;
  set(
    produce((state: AnimationData): void => {
      const updates: Record<string, { locked?: boolean }> = {};
      ids.forEach((id) => {
        updates[id] = { locked };
      });
      state.globalSourceTree = computeUpdatedSources(state.globalSourceTree, updates);
    }),
  );
}

export function setPreferences(
  set: AnimationStoreSetter,
  preferences: AnimationPreferencesPatch,
): void {
  set((state) => {
    const mergedNewKeyDefaults = preferences.newKeyDefaults
      ? {
          ...state.preferences.newKeyDefaults,
          ...preferences.newKeyDefaults,
          transitions: {
            ...state.preferences.newKeyDefaults.transitions,
            ...preferences.newKeyDefaults.transitions,
          },
        }
      : state.preferences.newKeyDefaults;

    return {
      preferences: {
        ...state.preferences,
        ...preferences,
        newKeyDefaults: mergedNewKeyDefaults,
      },
    };
  });
}
