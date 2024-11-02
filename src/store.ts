import {
  reset,
  update,
  play,
  pause,
  setBounds,
  setViewport,
  RawValue,
  Write,
  AnimatableValue,
  StoreSubscribeWithSelector,
  seek,
  getLookup,
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
} from "./types";
import {
  AnimationData,
  AnimationActions,
  AnimationStoreGetter,
  AnimationStoreSetter,
  Preview,
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
              // console.log("clearing value for key ", key);
              state.values.delete(key);
            } else {
              // console.log("setting value for key ", key, value);
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
    // Set the timescale of the animation playback
    updateTimescale: (speed: number) => {
      set(
        produce((state: AnimationData) => {
          state.player.timescale = speed;
        }),
      );
    },
    // Set the time of the animation
    resetPlayer: (time?: number) => {
      set((state: AnimationData) => ({ player: reset(state.player, time) }));
    },
    // Play the animation
    playPlayer: (speed?: number) => {
      set((state: AnimationData) => ({ player: play(state.player, speed) }));
    },
    // Pause the animation
    pausePlayer: () => {
      set((state: AnimationData) => ({ player: pause(state.player) }));
    },
    // Update the timer
    updatePlayer: (coldStart?: boolean) => {
      set((state: AnimationData) => ({
        player: update(state.player, state.duration, coldStart ?? false),
      }));
    },
    // Set the player bounds
    updatePlayerBounds: (start: number, end: number) => {
      set((state: AnimationData) => ({
        player: setBounds(state.player, [start, end]),
      }));
    },
    updatePlayerBound: (bound: "start" | "end", time?: number) => {
      set((state: AnimationData) => {
        const t = time ?? state.player.stamp;
        if (bound === "start" && state.player.bounds[1] <= t) {
          return {
            player: setBounds(state.player, [state.player.bounds[1], t]),
          };
        } else if (bound === "end" && state.player.bounds[0] >= t) {
          return {
            player: setBounds(state.player, [t, state.player.bounds[0]]),
          };
        } else if (bound === "start") {
          return {
            player: setBounds(state.player, [t, state.player.bounds[1]]),
          };
        } else {
          return {
            player: setBounds(state.player, [state.player.bounds[0], t]),
          };
        }
      });
    },
    // Set the player viewport
    updatePlayerViewport: (start: number, end: number) => {
      set((state: AnimationData) => ({
        player: setViewport(state.player, [start, end]),
      }));
    },
    updatePlayerViewportCenter: (time?: number) => {
      set((state: AnimationData) => ({
        player: seek(state.player, time ?? state.player.stamp),
      }));
    },
    updatePlayerViewportBound: (bound: "start" | "end", time: number) => {
      set((state: AnimationData) => {
        if (bound === "start" && state.player.viewport[1] <= time) {
          return {
            player: setViewport(state.player, [state.player.viewport[1], time]),
          };
        } else if (bound === "end" && state.player.viewport[0] >= time) {
          return {
            player: setViewport(state.player, [time, state.player.viewport[0]]),
          };
        } else if (bound === "start") {
          return {
            player: setViewport(state.player, [time, state.player.viewport[1]]),
          };
        } else {
          return {
            player: setViewport(state.player, [state.player.viewport[0], time]),
          };
        }
      });
    },
    // Skip to the next keyframe
    skipToNextKeyframe: (
      animationId: string,
      namespaceIds: string[],
      trackIds: string[],
      respectBounds?: boolean,
    ) => {
      set(
        produce((state: AnimationData) => {
          const animation = state.animations[animationId];
          const trackFilter: string[] = trackIds.length > 0 ? trackIds : animation.tracks;
          const trackSubset = pick(state.tracks, trackFilter);
          const instanceInfo = pick(state.animations[animationId].instances, namespaceIds);
          const nextStamp = computeNextTime(
            trackSubset,
            instanceInfo,
            state.player.stamp,
            state.player.bounds,
            respectBounds ?? false,
          );
          if (nextStamp !== undefined) {
            state.player = reset(state.player, nextStamp);
          }
        }),
      );
    },
    // Skip to the previous keyframe
    skipToPrevKeyframe: (
      animationId: string,
      namespaceIds: string[],
      trackIds: string[],
      respectBounds?: boolean,
    ) => {
      set(
        produce((state: AnimationData) => {
          const animation = state.animations[animationId];
          const trackFilter: string[] = trackIds.length > 0 ? trackIds : animation.tracks;
          const trackSubset = pick(state.tracks, trackFilter);
          const instanceInfo = pick(state.animations[animationId].instances, namespaceIds);
          const previousStamp = computePreviousTime(
            trackSubset,
            instanceInfo,
            state.player.stamp,
            state.player.bounds,
            respectBounds ?? false,
          );
          if (previousStamp !== undefined) {
            state.player = reset(state.player, previousStamp);
          }
        }),
      );
    },
    // Skip to the start of the current bounds
    skipToStart: () => {
      set((state: AnimationData) => ({
        player: reset(state.player, state.player.bounds[0]),
      }));
    },
    // Skip to the end of the current bounds
    skipToEnd: () => {
      set((state: AnimationData) => ({
        player: reset(state.player, state.player.bounds[1]),
      }));
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
      console.log("Storage animation", stored);
      return stored;
    },
    getAnimationsToSave: (): StoredAnimation[] => {
      const state = get();
      return Object.keys(state.animations).map((animationId) =>
        state.getStorableAnimation(animationId),
      );
    },
    initAnimationSubscriptions: () => {
      const updatePlayerInner = get().updatePlayer;
      const updateValues = get().updateValues;

      // If the time changes, check if it matches an existing keyframe and
      // set the current selected keyframe
      const unsubs = [
        // api.subscribe(
        //   (state) => ({
        //     running: state.player.running,
        //     stamp: state.player.stamp,
        //     keyframes: state.animations[state.activeAnimation]?.frames,
        //   }),
        //   ({ running, stamp, keyframes }) => {
        //     if (running) {
        //       // The animation is running, so don't select any keyframe
        //       set({ selectedKeyframe: undefined });
        //     } else {
        //       // The animation isn't running, so select the keyframe that matches the current time
        //       // If none match, return undefined
        //       const selectedKeyframe = Array.from(keyframes.values()).find(
        //         (keyframe: Keyframe) => keyframe?.stamp === stamp,
        //       );
        //       set({ selectedKeyframe: selectedKeyframe?.id });
        //     }
        //   },
        //   {
        //     equalityFn: (current: StampAndKeyframes, previous: StampAndKeyframes) =>
        //       current.stamp === previous.stamp && current.keyframes === previous.keyframes,
        //   },
        // ),

        // If the playing state changes, start or stop the interval that updates the player
        api.subscribe(
          (state: AnimationData) => ({
            running: state.player.running,
            interval: state.playerInterval,
          }),
          ({ running, interval }) => {
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
          { equalityFn: (current, previous) => current.running === previous.running },
        ),

        // If the timer's timestamp changes, rerun the interpolators with that time.
        api.subscribe(
          (state: AnimationData) => ({
            trackInterpolators: state.trackInterpolators,
            stamp: state.player.stamp,
          }),
          ({ trackInterpolators, stamp }) => {
            const result = new Map<string, RawValue | undefined>();
            Object.entries(trackInterpolators).forEach(([key, trackInterpolator]) => {
              result.set(key, trackInterpolator(stamp));
            });
            updateValues(result);
          },
          { equalityFn: (current, previous) => current.stamp === previous.stamp },
        ),

        // Generates an intermediate version of the animation that can be used to more easily
        // identify changes for each track, used for generating track interpolators in unsub4b
        // api.subscribe(
        //   (state) => ({
        //     animationKeys: Object.keys(state.animations),
        //     animationSubscribers: state.animationSubscribers,
        //   }),
        //   ({ animationKeys, animationSubscribers }) => {
        //     // Clear the previous subscriptions for each animation;
        //     animationSubscribers.forEach((animationUnsub) => {
        //       animationUnsub();
        //     });

        //     const newSubscribes = animationKeys.map((animationId) =>
        //       api.subscribe(
        //         (state) => state.animations[animationId],
        //         (animation: Animation) => {
        //           const cache = computeAnimationCache(animation);
        //           set((state) => ({
        //             animationCache: { ...state.animationCache, ...cache },
        //           }));
        //         },
        //         { equalityFn: shallow, fireImmediately: true },
        //       ),
        //     );

        //     set({ animationSubscribers: newSubscribes });
        //   },
        //   {
        //     equalityFn: (current, previous) =>
        //       isEqual(current.animationKeys, previous.animationKeys),
        //   },
        // ),
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
                  // console.log("subscribing", animationId, trackId, animations);
                  return api.subscribe(
                    // Monitor changes in instances, track, [all] frames and [all] points
                    (state: AnimationData) => ({
                      instances: state.animations[animationId].instances,
                      track: state.tracks[trackId],
                      duration: state.animations[animationId].duration,
                      animatableValue:
                        state.animatables[
                          Object.values(state.controls).find(
                            (control) => control.writeId === trackId,
                          )?.readId ?? ""
                        ],
                    }),
                    ({ track, instances, duration, animatableValue }) => {
                      // if (!track) return;
                      if (!track) return;

                      const newVals = new Map<string, RawValue | undefined>();
                      const newTrackInterpolators: Record<string, TrackInterpolator> = {};
                      let newViolations: Violation[] = [];
                      Object.keys(instances).forEach((namespace) => {
                        const lookup = getLookup(namespace, trackId);
                        const trackInterp = computeTrackInterpolator(track, instances[namespace]);
                        newTrackInterpolators[lookup] = trackInterp;
                        newVals.set(lookup, trackInterp(api.getState().player.stamp));
                        newViolations = [
                          ...newViolations,
                          ...computeTrackViolations(
                            trackInterp,
                            duration,
                            trackId,
                            namespace,
                            animatableValue,
                          ),
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
                      equalityFn: (
                        current: TrackAndInstanceData,
                        previous: TrackAndInstanceData,
                      ) => {
                        // We avoid some computation by subscribing to the cache, isntead of the track
                        // that just computes an intermediate value that is tracked.
                        return (
                          current.duration === previous.duration &&
                          // shallow(current.track, previous.track) &&
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

// interface StampAndKeyframes {
//   running: boolean;
//   stamp: number;
//   keyframes: Map<string, Keyframe>;
// }

interface AnimationsAndSubscribes {
  animations: Record<string, Animation>;
  subscribes: (() => void)[];
}

interface TrackAndInstanceData {
  // track?: Track;
  track?: Track<RawValue>;
  instances: Record<string, InstanceInfo>;
  duration: number;
  animatableValue?: AnimatableValue;
}

// interface TrackIdsAndSubscribes {
//   trackIds: string[];
//   subscribes: (() => void)[];
// }
