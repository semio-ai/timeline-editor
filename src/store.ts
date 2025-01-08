import {
  RawValue,
  Write,
  AnimatableValue,
  StoreSubscribeWithSelector,
  getLookup,
  usePlayerStore,
  PlayerData,
} from "@semio/utils";
import { TimeDisplay } from "@semio/ui";
import { subscribeWithSelector } from "zustand/middleware";
import { shallow } from "zustand/shallow";
import { produce, enableMapSet } from "immer";
import { create, type StoreApi } from "zustand";
import { isEqual, pick } from "lodash";
import {
  Keypoint,
  Track,
  InstanceInfo,
  TrackInterpolator,
  Animation,
  Violation,
  StoredAnimation,
  SemanticTime,
  Preview,
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
  setValue,
  updateControlColor,
} from "./actions";
import {
  computeTrackViolations,
  computeTrackInterpolator,
  computeNextTime,
  computePreviousTime,
  computeStoredAnimation,
} from "./functions";

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
    createNewDefaultAnimation: () => {
      set(
        produce((state: AnimationData) => {
          const defaultAnimation = createDefaultAnimation();
          state.activeAnimation = defaultAnimation.id;
          state.animations[defaultAnimation.id] = defaultAnimation;
          state.visualizedAnimations.push(defaultAnimation.id);
          state.duration = defaultAnimation.duration;
        }),
      );
    },
    setActiveAnimation: (animationId: string) => {
      set({ activeAnimation: animationId });
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
    updateKeypoint: (trackId: string, keypoint: Partial<Keypoint<RawValue>>) => {
      set(
        produce((state: AnimationData): void => {
          updateKeypoint(state, trackId, keypoint);
        }),
      );
    },
    updateKeypoints: (keypoints: { trackId: string; keypoint: Partial<Keypoint<RawValue>> }[]) => {
      set(
        produce((state: AnimationData): void => {
          keypoints.forEach(({ trackId, keypoint }) => {
            updateKeypoint(state, trackId, keypoint);
          });
        }),
      );
    },
    addAnimation: (animation: unknown) => {
      set(
        produce((state: AnimationData): void => {
          addAnimation(state, animation);
        }),
      );
    },
    removeAnimation: (animationId: string) => {
      set(
        produce((state: AnimationData): void => {
          removeAnimation(state, animationId);
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
    createTrack: (track: Partial<Track<RawValue>>, animationId?: string) => {
      set(
        produce((state: AnimationData) => {
          createTrack(state, animationId ?? state.activeAnimation, track);
        }),
      );
    },
    removeTrack: (trackId: string, animationId?: string) => {
      set(
        produce((state: AnimationData) => {
          removeTrack(state, animationId ?? state.activeAnimation, trackId);
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
      const state = get();
      const playerState = usePlayerStore.getState();
      const animation = state.animations[animationId];
      const trackFilter: string[] = trackIds.length > 0 ? trackIds : animation.tracks;
      const trackSubset = pick(state.tracks, trackFilter);
      const instanceInfo = pick(state.animations[animationId].instances, namespaceIds);
      const nextStamp = computeNextTime(
        trackSubset,
        instanceInfo,
        playerState.player.stamp,
        playerState.player.bounds,
        respectBounds ?? false,
      );
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
      const instanceInfo = pick(state.animations[animationId].instances, namespaceIds);
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
      set({ duration });
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
      const playerStoreState = usePlayerStore.getState();
      const updatePlayerInner = playerStoreState.updatePlayer;
      const updateDuration = playerStoreState.updateDuration;
      const updateValues = get().updateValues;

      // If the time changes, check if it matches an existing keyframe and
      // set the current selected keyframe
      const unsubs = [
        // If the playing state changes, start or stop the interval that updates the player
        usePlayerStore.subscribe(
          (state: PlayerData) => state.player.running,
          (running) => {
            const interval = get().playerInterval;
            if (interval) {
              window.clearInterval(interval);
            }

            if (running) {
              updatePlayerInner(true);
              const newInterval = window.setInterval(() => {
                updatePlayerInner(false);
              }, 25);
              set({ playerInterval: newInterval });
            }
          },
          { equalityFn: shallow },
        ),

        // If the duration changes, update the duration of the playerStore
        api.subscribe(
          (state: AnimationData) =>
            state.animations[state.activeAnimation]?.duration ?? state.duration,
          (duration) => {
            updateDuration(duration);
          },
          { equalityFn: shallow, fireImmediately: true },
        ),

        // If the interpolators change, rerun the interpolators with the time from the playerStore.
        api.subscribe(
          (state: AnimationData) => state.trackInterpolators,
          (trackInterpolators) => {
            const stamp = usePlayerStore.getState().player.stamp;
            const result = new Map<string, RawValue | undefined>();
            Object.entries(trackInterpolators).forEach(([key, trackInterpolator]) => {
              result.set(key, trackInterpolator(stamp));
            });
            updateValues(result);
          },
          { equalityFn: (current, previous) => current.stamp === previous.stamp },
        ),

        // If the time changes, run the interpolators with the new time
        usePlayerStore.subscribe(
          (state: PlayerData) => state.player.stamp,
          (stamp) => {
            const trackInterpolators = get().trackInterpolators;
            const result = new Map<string, RawValue | undefined>();
            Object.entries(trackInterpolators).forEach(([key, trackInterpolator]) => {
              result.set(key, trackInterpolator(stamp));
            });
            updateValues(result);
          },
          { equalityFn: shallow },
        ),

        api.subscribe(
          (state: AnimationData) => ({
            animations: state.animations,
            subscribes: state.trackSubscribers,
          }),
          ({ animations, subscribes }) => {
            // Clear the previous subscriptions for each track
            subscribes.forEach((trackUnsub) => {
              trackUnsub();
            });
            // Creat new subscriptions
            const newSubscribes = Object.entries(animations)
              .map(([animationId, animation]) =>
                Array.from(animation.tracks).map((trackId) => {
                  return api.subscribe(
                    // Monitor changes in instances, track, [all] frames and [all] points
                    (state: AnimationData) => {
                      return {
                        instances: state.animations[animationId].instances,
                        track: state.tracks[trackId],
                        duration: state.animations[animationId].duration,
                        animatableValue:
                          state.animatables[
                            Object.values(state.controls).find(
                              (control) => control.writeId === trackId,
                            )?.readId ?? ""
                          ],
                      };
                    },
                    ({ track, instances, duration, animatableValue }) => {
                      if (!track) return;

                      const newVals = new Map<string, RawValue | undefined>();
                      const newTrackInterpolators: Record<string, TrackInterpolator> = {};
                      let newViolations: Violation[] = [];
                      Object.keys(instances).forEach((namespace) => {
                        const lookup = getLookup(namespace, trackId);
                        const trackInterp = computeTrackInterpolator(track, instances[namespace]);
                        newTrackInterpolators[lookup] = trackInterp;
                        newVals.set(lookup, trackInterp(usePlayerStore.getState().player.stamp));
                        newViolations = [
                          ...newViolations,
                          ...(animatableValue
                            ? computeTrackViolations(
                                trackInterp,
                                duration,
                                trackId,
                                namespace,
                                animatableValue,
                              )
                            : []),
                        ];
                      });
                      set((state: AnimationData) => ({
                        trackInterpolators: {
                          ...state.trackInterpolators,
                          ...newTrackInterpolators,
                        },
                        values: new Map([...state.values, ...newVals]),
                        violations: { ...state.violations, [trackId]: newViolations },
                      }));
                    },
                    {
                      fireImmediately: true,
                      equalityFn: (
                        current: TrackAndInstanceData,
                        previous: TrackAndInstanceData,
                      ) => {
                        // We avoid some computation by subscribing to the cache, isntead of the track
                        // that just computes an intermediate value that is tracked.
                        return (
                          current.duration === previous.duration &&
                          shallow(current.track, previous.track) &&
                          shallow(current.instances, previous.instances) &&
                          shallow(current.animatableValue, previous.animatableValue)
                        );
                      },
                    },
                  );
                }),
              )
              .flat();

            set({ trackSubscribers: newSubscribes });
          },
          {
            equalityFn: (current: AnimationsAndSubscribes, previous: AnimationsAndSubscribes) => {
              // We only care about cases where the individual track ids change across all animations
              const allCurrent = new Set(
                ...Object.values(current.animations)
                  .map((a) => a.tracks.keys())
                  .flat(),
              );
              const allPrevious = new Set(
                ...Object.values(previous.animations)
                  .map((a) => a.tracks.keys())
                  .flat(),
              );
              return isEqual(allCurrent, allPrevious);
            },
          },
        ),
      ];

      return () => {
        unsubs.forEach((unsub) => unsub());
      };
    },
    setHoverpoint: (hoverpoint: number) => {
      set({ hoverpoint });
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
    setValue: (id: string, namespace: string, value: RawValue) => {
      set(
        produce((state: AnimationData) => {
          setValue(state, id, namespace, value);
        }),
      );
    },
    setValues: (updates: { animatableId: string; namespace: string; value: RawValue }[]) => {
      set(
        produce((state: AnimationData) => {
          updates.forEach(({ animatableId, namespace, value }) =>
            setValue(state, animatableId, namespace, value),
          );
        }),
      );
    },
    setPreferences: (preferences: Partial<AnimationData["preferences"]>) => {
      set((state) => ({
        preferences: { ...state.preferences, ...preferences },
      }));
    },
  };
};

export const useDefaultAnimationStore = create<AnimationData & AnimationActions>()(
  subscribeWithSelector((set, get, api) => ({
    ...AnimationSlice(set, get, api),
  })),
);

export type AnimationStore = typeof useDefaultAnimationStore;

interface AnimationsAndSubscribes {
  animations: Record<string, Animation>;
  subscribes: (() => void)[];
}

interface TrackAndInstanceData {
  track?: Track<RawValue>;
  instances: Record<string, InstanceInfo>;
  duration: number;
  animatableValue?: AnimatableValue;
}
