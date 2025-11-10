import { RawValue, getLookup, usePlayerStore, AnimatableValue } from "@semio/utils";
import { TimeDisplay } from "@semio/ui";
import { subscribeWithSelector } from "zustand/middleware";
import { produce, enableMapSet } from "immer";
import { mapValues } from "lodash";
import { create } from "zustand";
import {
  Keypoint,
  Track,
  StoredAnimation,
  SemanticTime,
  Preview,
  SourceRow,
  SourceRowData,
  TrackRender,
  Namespace,
  DragUpdateInput,
  DragStartInput,
  VerticalAxis,
} from "./types";
import {
  AnimationData,
  AnimationActions,
  AnimationStoreGetter,
  AnimationStoreSetter,
  AnimationApi,
} from "./store-types";
import {
  createKeypoint,
  updateKeypoint,
  removeKeypoint,
  createTrack,
  removeTrack,
  createDefaultState,
  updateTrack,
  addAnimation,
  removeAnimation,
  createDefaultAnimation,
  updateControlColor,
} from "./actions";
import { clickMarkerAction, clearSelectionAction } from "./actions/click-marker";
import { startDrag, updateDrag, commitDrag, cancelDrag } from "./actions/drag";
import {
  computeStoredAnimation,
  computeNextTime,
  computePreviousTime,
  computeUpdatedSources,
} from "./functions";
import {
  updatePlayerLoop,
  updateOverallDuration,
  updateInstancedTrackSources,
  updateConsolidatedSourceRow,
  updateGlobalSources,
  updateSourceRowIds,
  initDerivedOrchestrator,
} from "./subscriptions";
import { View } from "./types/util/view";
import { createEmptySelectionState } from "./functions/selection-state-manager";
import { clickLineAction } from "./actions/click-line";

enableMapSet();

export const AnimationSlice = (
  set: AnimationStoreSetter,
  get: AnimationStoreGetter,
  api: AnimationApi,
) => {
  return {
    ...createDefaultState(),
    updateSource: (groupId: string, expanded?: boolean, hidden?: boolean) => {
      set(
        produce((state: AnimationData) => {
          // Updates global sources, affecting all views
          const updates = { [groupId]: { expanded, hidden } };
          state.sourcesByAnimationInstance = mapValues(
            state.sourcesByAnimationInstance,
            (instanceSources) => computeUpdatedSources(instanceSources, updates),
          );
        }),
      );
    },
    updateSources: (updates: Record<string, { expanded?: boolean; hidden?: boolean }>) => {
      set(
        produce((state: AnimationData) => {
          // Updates global sources, affecting all views
          state.sourcesByAnimationInstance = mapValues(
            state.sourcesByAnimationInstance,
            (instanceSources) => computeUpdatedSources(instanceSources, updates),
          );
        }),
      );
    },
    updateValues: (values: Map<string, RawValue | undefined>) => {
      set(
        produce((state: AnimationData) => {
          values.forEach?.((value, key) => {
            if (value === undefined) {
              state.values.delete(key);
            } else {
              state.values.set(key, value);
            }
          });
        }),
      );
    },
    updateVelocities: (velocities: Map<string, RawValue | undefined>) => {
      set(
        produce((state: AnimationData) => {
          velocities.forEach?.((value, key) => {
            if (value === undefined) {
              state.velocities.delete(key);
            } else {
              state.velocities.set(key, value);
            }
          });
        }),
      );
    },
    setValue: (
      id: string,
      namespace: string,
      value: RawValue | ((current: RawValue) => RawValue),
    ) => {
      set(
        produce((state) => {
          const lookupId = getLookup(namespace, id);
          if (typeof value === "function") {
            const current: RawValue | undefined = state.values.get(lookupId);
            if (current === undefined) {
              // Get the default value from the animatable if it exists
              const animatable = state.animatables[id];
              state.values.set(lookupId, value(animatable.default as RawValue));
            } else {
              state.values.set(lookupId, value(current));
            }
          } else {
            state.values.set(lookupId, value);
          }
        }),
      );
    },
    createNewDefaultAnimation: () => {
      set(
        produce((state: AnimationData) => {
          const defaultAnimation = createDefaultAnimation();
          addAnimation(state, defaultAnimation);
        }),
      );
    },
    setAnimatables: (animatables: Record<string, AnimatableValue>) => {
      set(
        produce((state: AnimationData): void => {
          state.animatables = animatables;
        }),
      );
    },
    setNamespaces: (namespaces: Record<string, Namespace>) => {
      set(
        produce((state: AnimationData): void => {
          state.namespaces = namespaces;
        }),
      );
    },
    updateKeypoint: (
      trackId: string,
      keypoint: Partial<Keypoint<RawValue>>,
      canMerge?: boolean,
    ) => {
      set(
        produce((state: AnimationData): void => {
          updateKeypoint(state, trackId, keypoint, canMerge);
        }),
      );
    },
    updateKeypoints: (
      keypoints: { trackId: string; keypoint: Partial<Keypoint<RawValue>> }[],
      canMerge?: boolean,
    ) => {
      set(
        produce((state: AnimationData): void => {
          keypoints.forEach(({ trackId, keypoint }) => {
            updateKeypoint(state, trackId, keypoint, canMerge);
          });
        }),
      );
    },
    addView: (view: Partial<View> & { id: string }) => {
      set((state: AnimationData) => {
        const defaultView: View = {
          id: view.id,
          trackRender: view.trackRender ?? TrackRender.Key,
          verticalAxis: view.verticalAxis ?? VerticalAxis.Normalized,
        };
        return {
          editorViews: { ...state.editorViews, [view.id]: { ...defaultView, ...view } },
        };
      });
    },
    updateView: (viewId: string, view: Partial<View>) => {
      set(
        produce((state: AnimationData) => {
          if (!state.editorViews[viewId]) return;
          state.editorViews[viewId] = { ...state.editorViews[viewId], ...view };
        }),
      );
    },
    removeView: (viewId: string) => {
      set(
        produce((state: AnimationData) => {
          if (!state.editorViews[viewId]) return;
          const { [viewId]: _, ...rest } = state.editorViews;
          state.editorViews = rest;
        }),
      );
    },
    addAnimation: (animation: StoredAnimation) => {
      set(
        produce((state: AnimationData): void => {
          addAnimation(state, animation);
        }),
      );
    },
    setAnimations: (animations: Record<string, StoredAnimation>) => {
      set(
        produce((state: AnimationData): void => {
          // Clear existing animations
          state.animations = {};
          // Add all animations
          Object.values(animations).forEach((animation) => {
            addAnimation(state, animation);
          });
        }),
      );
    },
    removeAnimation: (animationId: string, removeTracks = true) => {
      set(
        produce((state: AnimationData): void => {
          removeAnimation(state, animationId, removeTracks);
        }),
      );
    },
    createKeypoint: (trackId: string, point: Partial<Keypoint<RawValue>>) => {
      set(
        produce((state: AnimationData): void => {
          createKeypoint(state, trackId, point);
        }),
      );
    },
    createKeypoints: (keypoints: { trackId: string; keypoint: Partial<Keypoint<RawValue>> }[]) => {
      set(
        produce((state: AnimationData): void => {
          keypoints.forEach(({ trackId, keypoint }) => {
            createKeypoint(state, trackId, keypoint);
          });
        }),
      );
    },
    updateTrack: (track: Partial<Track<RawValue>>) => {
      set(
        produce((state: AnimationData) => {
          updateTrack(state, track);
        }),
      );
    },
    removeKeypoint: (trackId: string, keypointId: string) => {
      set(
        produce((state: AnimationData): void => {
          removeKeypoint(state, trackId, keypointId);
        }),
      );
    },
    removeKeypoints: (keypoints: { trackId: string; keypointId: string }[]) => {
      set(
        produce((state: AnimationData): void => {
          keypoints.forEach(({ trackId, keypointId }) => {
            removeKeypoint(state, trackId, keypointId);
          });
        }),
      );
    },
    createTrack: (track: Partial<Track<RawValue>>, animatableId: string, animationId: string) => {
      set(
        produce((state: AnimationData): void => {
          createTrack(state, animatableId, animationId, track);
        }),
      );
    },
    setTracks: (tracks: Record<string, Track<RawValue>>) => {
      set(
        produce((state: AnimationData): void => {
          // Clear existing tracks
          state.tracks = {};
          // Add all tracks with their points
          Object.entries(tracks).forEach(([trackId, track]) => {
            state.tracks[trackId] = track;
          });
        }),
      );
    },
    removeTrack: (trackId: string, animationId: string) => {
      set(
        produce((state: AnimationData) => {
          removeTrack(state, animationId, trackId);
        }),
      );
    },
    // Skip to the next keyframe
    skipToNextKeyframe: (sourceRow: SourceRow, respectBounds?: boolean) => {
      const state = get();
      const playerState = usePlayerStore.getState();
      const sourceRowId = sourceRow.id;
      const computedData = state.derivedSnapshot?.rows?.[sourceRowId]?.computed;
      if (!computedData) return;

      const instancedFrameData = computedData.virtualFrames;
      const nextTime = computeNextTime(
        instancedFrameData,
        playerState.player.stamp,
        playerState.player.bounds,
        respectBounds ?? false,
      );
      if (nextTime !== undefined) {
        playerState.resetPlayer(nextTime);
      }
    },
    // Skip to the previous keyframe
    skipToPrevKeyframe: (sourceRow: SourceRow, respectBounds?: boolean) => {
      const state = get();
      const playerState = usePlayerStore.getState();
      const sourceRowId = sourceRow.id;
      const computedData = state.derivedSnapshot?.rows?.[sourceRowId]?.computed;
      if (!computedData) return;

      const instancedFrameData = computedData.virtualFrames;
      const previousTime = computePreviousTime(
        instancedFrameData,
        playerState.player.stamp,
        playerState.player.bounds,
        respectBounds ?? false,
      );
      if (previousTime !== undefined) {
        playerState.resetPlayer(previousTime);
      }
    },
    // Skip to the start of the current bounds
    skipToStart: () => {
      const playerState = usePlayerStore.getState();
      playerState.resetPlayer(playerState.player.bounds[0]);
    },
    // Skip to the end of the current bounds
    skipToEnd: () => {
      const playerState = usePlayerStore.getState();
      playerState.resetPlayer(playerState.player.bounds[1]);
    },
    // Set the duration of the animation
    updateDuration: (duration: number) => {
      const playerState = usePlayerStore.getState();
      playerState.updateDuration(duration);
      set({ duration });
    },
    updateAnimationDuration: (animationId: string, duration: number, rescale: boolean) => {
      set(
        produce((state: AnimationData) => {
          const oldDuration = state.animations[animationId].duration;
          state.animations[animationId].duration = duration;
          if (!rescale) {
            // Adjust the stamps (percentage of completion) to match the new duration's range
            state.animations[animationId].tracks.forEach((trackId) => {
              state.tracks[trackId].points = state.tracks[trackId].points.map((point) => ({
                ...point,
                stamp: (point.stamp * oldDuration) / duration,
              }));
            });
          }
        }),
      );
    },
    // Set the frame rate of the animation
    updateFramerate: (framerate: number) => {
      set({ framerate });
    },
    setExpanded: (expanded: boolean) => {
      set({ expanded });
    },
    setTimeDisplay: (timeDisplay: TimeDisplay) => {
      set({ timeDisplay });
    },
    getStorableAnimation: (animationId: string) => {
      const state = get();
      const stored = computeStoredAnimation(state.animations[animationId], state.tracks);
      return stored;
    },
    getAnimationsToSave: (): StoredAnimation[] => {
      const state = get();
      return Object.keys(state.animations).map((animationId) =>
        state.getStorableAnimation(animationId),
      );
    },
    initAnimationSubscriptions: () => {
      // Clean up any previous subscriptions for this store instance
      const existingCleanup = (api as any).__derivedCleanup as (() => void) | undefined;
      if (typeof existingCleanup === "function") {
        existingCleanup();
        (api as any).__derivedCleanup = undefined;
      }

      // Delay subscription initialization to prevent cascading updates during store creation
      const unsubs = [
        updatePlayerLoop,
        updateOverallDuration,
        initDerivedOrchestrator,
        updateInstancedTrackSources,
        updateGlobalSources,
        updateSourceRowIds,
        updateConsolidatedSourceRow,
      ].map((fn) => fn(api, set, get));

      const cleanup = () => {
        unsubs.forEach((unsub) => unsub());
      };
      (api as any).__derivedCleanup = cleanup;
      return cleanup;
    },
    /**
     * Handle marker click with various modifier key behaviors for selection.
     *
     * Selection behaviors:
     * 1. A plain click replaces the current selection and sets the clicked marker as the reference.
     * 2. Ctrl/Cmd-click toggles a marker in the selection (cross-row allowed) and, when adding, updates the reference to that marker.
     * 3. Shift-click within the reference row selects the range between the anchor and clicked markers without updating the reference.
     * 4. Shift-click in any other row behaves like a plain click (replaces selection and moves the reference).
     * 5. If Ctrl/Cmd-click removes the reference marker, the reference is cleared until another marker is explicitly clicked.
     *
     * @param clickedPoints - The actual points that were clicked (pre-filtered for selectable).
     * @param rowId - The source row containing the marker.
     * @param markerId - The marker identifier within the row.
     * @param shift - Whether shift key is held.
     * @param mod - Whether mod key (Cmd on Mac, Ctrl on PC) is held.
     */
    clickMarker: (
      clickedPoints: (SourceRowData & { id: string })[],
      rowId: string,
      markerId: string,
      shift?: boolean,
      mod?: boolean,
    ) => {
      set((state: AnimationData) => {
        const result = clickMarkerAction(state, clickedPoints, rowId, markerId, shift, mod);
        return {
          ...state,
          ...result,
        };
      });
    },
    clickLine: (rowId: string, segmentId: string, shift?: boolean, mod?: boolean) => {
      set((state: AnimationData) => {
        const result = clickLineAction(state, rowId, segmentId, shift, mod);
        return {
          ...state,
          ...result,
        };
      });
    },
    clearSelection: () => {
      set((state: AnimationData) => clearSelectionAction(state));
    },
    focusSelectionInstance: (instanceId: string) => {
      set(() => ({ selectionState: createEmptySelectionState(instanceId) }));
    },
    addPreview: (preview: Preview) => {
      set((state: AnimationData) => ({
        previews: [...state.previews, preview],
      }));
    },
    removePreview: (evaluator: (preview: Preview) => boolean) => {
      set((state: AnimationData) => ({
        previews: state.previews.filter((p) => !evaluator(p)),
      }));
    },
    updatePreview: (evaluator: (preview: Preview) => boolean, preview: Partial<Preview>) => {
      set((state: AnimationData) => ({
        previews: state.previews.map((p) => (evaluator(p) ? { ...p, ...preview } : p)),
      }));
    },
    updateHoverpointPreview: (value: number | null) => {
      set((state: AnimationData) => {
        if (value !== null) {
          const currentIdx = state.previews.findIndex((p) => p.semanticTime === SemanticTime.Hover);
          if (currentIdx < 0) {
            return {
              previews: [
                ...state.previews,
                { semanticTime: SemanticTime.Hover, stamp: value, label: "Hover" },
              ],
            };
          } else {
            return {
              previews: state.previews.map((p, idx) =>
                idx === currentIdx
                  ? { semanticTime: SemanticTime.Hover, stamp: value, label: "Hover" }
                  : p,
              ),
            };
          }
        } else {
          return { previews: state.previews.filter((p) => p.semanticTime !== SemanticTime.Hover) };
        }
      });
    },
    updateControlColor: (controlId: string, color: string) => {
      set(
        produce((state: AnimationData): void => {
          updateControlColor(state, controlId, color);
        }),
      );
    },
    setPreferences: (preferences: Partial<AnimationData["preferences"]>) => {
      set((state) => ({
        preferences: { ...state.preferences, ...preferences },
      }));
    },

    // Drag actions - ID-based with instance validation
    startDrag: (input: DragStartInput) => {
      set(
        produce((state: AnimationData): void => {
          startDrag(state, input);
        }),
      );
    },
    updateDrag: (input: DragUpdateInput) => {
      set(
        produce((state: AnimationData): void => {
          updateDrag(state, input);
        }),
      );
    },
    commitDrag: () => {
      set(
        produce((state: AnimationData): void => {
          commitDrag(state);
        }),
      );
    },
    cancelDrag: () => {
      set(
        produce((state: AnimationData): void => {
          cancelDrag(state);
        }),
      );
    },
  };
};

export const useDefaultAnimationStore = create<AnimationData & AnimationActions>()(
  subscribeWithSelector((set, get, api) => ({
    ...AnimationSlice(set, get, api),
  })),
);

useDefaultAnimationStore.getState().initAnimationSubscriptions();

export function createAnimationStore(initial?: Partial<AnimationData>): AnimationStore {
  const store = create<AnimationData & AnimationActions>()(
    subscribeWithSelector((set, get, api) => ({
      ...AnimationSlice(set, get, api),
      ...initial,
    })),
  );
  store.getState().initAnimationSubscriptions();
  return store;
}

export type AnimationStore = typeof useDefaultAnimationStore;
