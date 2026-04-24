import { produce } from "immer";
import {
  collectSourceTracks,
  computeUpdatedSources,
  findSourceTrackById,
} from "../functions";
import { GROUP_TYPES } from "../constants";
import type {
  AnimationData,
  AnimationPreferencesPatch,
  AnimationStoreSetter,
} from "../store-types";
import type { Source, SourceGroup } from "../types";

/**
 * Collect track ids that are flagged hidden via the legacy global tree —
 * used as a one-time migration source when seeding the first editor view.
 */
export function collectLegacyHiddenTrackIds(
  globalSourceTree: AnimationData["globalSourceTree"],
): string[] {
  const hiddenIds = new Set<string>();
  collectSourceTracks(globalSourceTree).forEach((track) => {
    if (track.hidden) {
      hiddenIds.add(track.id);
    }
  });
  return Array.from(hiddenIds);
}

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

      // When unmuting, enforce one-unmuted-per-animatable constraint:
      // mute other tracks that share the same animatable in the same namespace.
      if (!muted) {
        ids.forEach((sourceId) => {
          const targetTrack = findSourceTrackById(state.globalSourceTree, sourceId);
          if (targetTrack) {
            const { namespaceId, animatableId } = targetTrack;
            if (animatableId) {
              collectSourceTracks(state.globalSourceTree).forEach((track) => {
                if (ids.includes(track.id)) return;
                if (track.namespaceId !== namespaceId) return;
                if (track.animatableId !== animatableId) return;
                updates[track.id] = { muted: true };
              });
            }
          }
        });
      }

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

export function setTracksLocked(
  set: AnimationStoreSetter,
  sourceIds: string | string[],
  locked: boolean,
): void {
  const ids = Array.isArray(sourceIds) ? sourceIds : [sourceIds];
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
