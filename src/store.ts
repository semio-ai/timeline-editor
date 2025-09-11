import {
  RawValue,
  Write,
  StoreSubscribeWithSelector,
  getLookup,
  usePlayerStore,
  AnimatableValue,
} from "@semio/utils";
import { TimeDisplay } from "@semio/ui";
import { subscribeWithSelector } from "zustand/middleware";
import { produce, enableMapSet } from "immer";
import { create, type StoreApi } from "zustand";
import { pick } from "lodash";
import {
  Keypoint,
  Track,
  AnimationInstance,
  StoredAnimation,
  SemanticTime,
  Preview,
  InstancedFrameInfo,
  Source,
} from "./types";
import {
  AnimationData,
  AnimationActions,
  AnimationStoreGetter,
  AnimationStoreSetter,
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
import { startDragging, updateDragDelta, commitDrag, cancelDrag } from "./actions/drag";
import {
  computeNextTime,
  computePreviousTime,
  computeStoredAnimation,
  computeMarkerSelection,
} from "./functions";
import {
  updatePlayerLoop,
  updateOverallDuration,
  updateInterpolationResultsOnStampChange,
  updateAllInterpolatorsAndResultsOnDataChange,
} from "./subscriptions";

enableMapSet();

export type AnimationApi = Write<
  StoreApi<AnimationData & AnimationActions>,
  StoreSubscribeWithSelector<AnimationData & AnimationActions>
>;

export const AnimationSlice = (
  set: AnimationStoreSetter,
  get: AnimationStoreGetter,
  api: AnimationApi,
) => {
  return {
    ...createDefaultState(),
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
    setValue: (id: string, namespace: string, value: RawValue) => {
      set(
        produce((state) => {
          console.log("(Scene) Setting value", id, namespace, value);
          const lookupId = getLookup(namespace, id);
          state.values.set(lookupId, value);
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
    visualizeAnimation: (animationId: string) => {
      set(
        produce((state: AnimationData): void => {
          state.visualizedAnimations = [...state.visualizedAnimations, animationId];
        }),
      );
    },
    unvisualizeAnimation: (animationId: string) => {
      set(
        produce((state: AnimationData): void => {
          state.visualizedAnimations = state.visualizedAnimations.filter(
            (id) => id !== animationId,
          );
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
    skipToNextKeyframe: (
      animationId: string,
      namespaceIds: string[],
      trackIds: string[],
      respectBounds?: boolean,
    ) => {
      console.log("skipping to next keyframe");
      const state = get();
      const playerState = usePlayerStore.getState();
      const animation = state.animations[animationId];
      const trackFilter: string[] = trackIds.length > 0 ? trackIds : animation.tracks;
      const trackSubset = pick(state.tracks, trackFilter);
      const instanceInfo: Record<string, AnimationInstance> = {};
      Object.entries(state.namespaceInfo).forEach(([namespace, instances]) => {
        if (namespaceIds.includes(namespace)) {
          Object.assign(instanceInfo, instances);
        }
      });
      // const instanceInfo = pick(state.animations[animationId].instances, namespaceIds);
      const nextStamp = computeNextTime(
        trackSubset,
        instanceInfo,
        playerState.player.stamp,
        playerState.player.bounds,
        respectBounds ?? false,
      );
      console.log("next stamp", nextStamp);
      if (nextStamp !== undefined) {
        playerState.resetPlayer(nextStamp);
      }
    },
    // Skip to the previous keyframe
    skipToPrevKeyframe: (
      animationId: string,
      namespaceIds: string[],
      trackIds: string[],
      respectBounds?: boolean,
    ) => {
      const state = get();
      const playerState = usePlayerStore.getState();
      const animation = state.animations[animationId];
      const trackFilter: string[] = trackIds.length > 0 ? trackIds : animation.tracks;
      const trackSubset = pick(state.tracks, trackFilter);
      const instanceInfo: Record<string, AnimationInstance> = {};
      Object.entries(state.namespaceInfo).forEach(([namespace, instances]) => {
        if (namespaceIds.includes(namespace)) {
          Object.assign(instanceInfo, instances);
        }
      });
      // const instanceInfo = pick(state.animations[animationId].instances, namespaceIds);
      const previousStamp = computePreviousTime(
        trackSubset,
        instanceInfo,
        playerState.player.stamp,
        playerState.player.bounds,
        respectBounds ?? false,
      );
      if (previousStamp !== undefined) {
        playerState.resetPlayer(previousStamp);
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
      const unsubs = [
        updatePlayerLoop,
        updateOverallDuration,
        updateInterpolationResultsOnStampChange,
        updateAllInterpolatorsAndResultsOnDataChange,
      ].map((fn) => fn(api, set, get));

      return () => {
        unsubs.forEach((unsub) => unsub());
      };
    },
    /**
     * Handle marker click with various modifier key behaviors for selection
     *
     * Selection Behaviors:
     * 1. Click (without modifier) on a marker always replaces the selection, and sets that marker to be the current reference.
     * 2. Ctrl-click can work across tracks, and toggles a given marker's selection, and updates the current reference to that marker (if toggled to be selected)
     * 3. Shift-click within a track when the last selected/activated marker is in that track selects all between the reference marker and the clicked marker.
     *    The newly clicked marker does not update the reference.
     * 4. Shift-click on a marker when that track does not have the reference acts like ctrl-click, except that it doesn't toggle off (only adds if not added) and sets the reference to that marker.
     * 5. If ctrl-click toggles off the reference point, a new reference point must be selected (via shift-click or ctrl-click) before any shift-spanning selection can happen.
     *
     * @param markerInfo - The marker that was clicked
     * @param sources - The sources for the clicked marker's track
     * @param allMarkerInfo - All markers in the track (used for range selection)
     * @param shift - Whether shift key is held
     * @param mod - Whether mod key (Cmd on Mac, Ctrl on PC) is held
     */
    clickMarker: (
      markerInfo: InstancedFrameInfo,
      sources: Source[],
      allMarkerInfo: InstancedFrameInfo[],
      shift?: boolean,
      mod?: boolean,
    ) => {
      set((state: AnimationData) => {
        const result = computeMarkerSelection(
          markerInfo,
          sources,
          allMarkerInfo,
          state.selection,
          state.referenceMarker,
          shift,
          mod,
        );
        return {
          selection: result.selection,
          referenceMarker: result.reference,
        };
      });
    },
    clearSelection: () => {
      set({ selection: [], referenceMarker: null });
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

    // Drag actions for virtual dragging functionality
    startDragging: (selection?: InstancedFrameInfo[]) => {
      set(
        produce((state: AnimationData) => {
          startDragging(state, selection);
        }),
      );
    },
    updateDragDelta: (deltaStamp: number, snapToFrames: boolean) => {
      set(
        produce((state: AnimationData) => {
          updateDragDelta(state, deltaStamp, snapToFrames);
        }),
      );
    },
    commitDrag: () => {
      set(
        produce((state: AnimationData) => {
          commitDrag(state);
        }),
      );
    },
    cancelDrag: () => {
      set(
        produce((state: AnimationData) => {
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
