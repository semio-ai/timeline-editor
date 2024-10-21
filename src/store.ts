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
import {
  Keyframe,
  Keypoint,
  Track,
  InstanceInfo,
  TrackInterpolator,
  Animation,
  Violation,
} from "./types";
import {
  AnimationData,
  AnimationActions,
  AnimationStoreGetter,
  AnimationStoreSetter,
  Preview,
} from "./store-types";
import { createKeyframe } from "./actions/create-keyframe";
import { createAutoKeyframe } from "./actions/create-auto-keyframe";
import { removeKeyframe } from "./actions/remove-keyframe";
import { updateKeyframeStamp } from "./actions/update-keyframe-stamp";
import { createKeypoint } from "./actions/create-keypoint";
import { updateKeypointValue } from "./actions/update-keypoint-value";
import { removeKeypoint } from "./actions/remove-keypoint";
import { createTrack } from "./actions/create-track";
import { removeTrack } from "./actions/remove-track";
import { moveKeypoint } from "./actions/move-keypoint";
import { createDefaultState } from "./actions/create-default-state";
import { updateAnimationKeypoint } from "./actions/update-animation-keypoint";
import { updateTrack } from "./actions/update-track";
import { addAnimation } from "./actions/add-animation";
import { removeAnimation } from "./actions/remove-animation";
import { createDefaultAnimation } from "./actions/create-default-animation";
import { setValue, updateControlColor } from "./actions/temp-duplicate-functions";
import { computeAnimationCache } from "./functions/compute-animation-cache";
import { computeTrackViolations } from "./functions/compute-track-violations";
import { computeTrackInterpolator } from "./functions/compute-track-interpolator";
import { computeStamps } from "./functions/compute-stamps";

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
    createKeyframe: (keyframe: Partial<Keyframe>, animationId?: string, fillPoints?: boolean) => {
      set(
        produce((state: AnimationData): void => {
          createKeyframe(state, animationId ?? state.activeAnimation, keyframe, fillPoints);
        }),
      );
    },
    createAutoKeyframe: () => {
      set(
        produce((state: AnimationData): void => {
          // This is basically the same as the above, but we don't need to
          // pass in a keyframe, and assume it happens at the current time
          createAutoKeyframe(state, state.activeAnimation);
        }),
      );
    },
    removeKeyframe: (keyframeId: string, animationId?: string) => {
      set(
        produce((state: AnimationData): void => {
          // Remove all points associated with the keyframe
          removeKeyframe(state, animationId ?? state.activeAnimation, keyframeId);
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
    updateAnimationKeypoint: (
      keyframeOrTime: string | number,
      trackId: string,
      value: RawValue,
      animationId?: string,
    ) => {
      set(
        produce((state: AnimationData): void => {
          updateAnimationKeypoint(
            state,
            animationId ?? state.activeAnimation,
            keyframeOrTime,
            trackId,
            value,
          );
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
    updateKeyframeStamp: (keyframeId: string, stamp: number, animationId?: string) => {
      set(
        produce((state: AnimationData): void => {
          updateKeyframeStamp(state, animationId ?? state.activeAnimation, keyframeId, stamp);
        }),
      );
    },
    createKeypoint: (trackId: string, point: Partial<Keypoint<RawValue>>, animationId?: string) => {
      set(
        produce((state: AnimationData): void => {
          createKeypoint(state, animationId ?? state.activeAnimation, trackId, point);
        }),
      );
    },
    updateKeypointValue: (keypointId: string, value: RawValue, animationId?: string) => {
      set(
        produce((state: AnimationData): void => {
          updateKeypointValue(state, animationId ?? state.activeAnimation, keypointId, value);
        }),
      );
    },
    updateTrack: (trackId: string, data: Omit<Track, "id" | "points">, animationId?: string) => {
      set(
        produce((state: AnimationData) => {
          updateTrack(state, animationId || state.activeAnimation, trackId, data);
        }),
      );
    },
    removeKeypoint: (keypointId: string, animationId?: string) => {
      set(
        produce((state: AnimationData): void => {
          removeKeypoint(state, animationId ?? state.activeAnimation, keypointId);
        }),
      );
    },
    createTrack: (track: Partial<Track>, animationId?: string) => {
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
    // Move a waypoint to a new keyframe or track;
    moveKeypoint: (
      keypointId: string,
      keyframeOrTime: string | number,
      trackId: string,
      animationId?: string,
    ) => {
      set(
        produce((state: AnimationData) => {
          moveKeypoint(
            state,
            animationId ?? state.activeAnimation,
            keypointId,
            keyframeOrTime,
            trackId,
          );
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
    skipToNextKeyframe: (trackIds?: string[], respectBounds?: boolean) => {
      set(
        produce((state: AnimationData) => {
          const allStamps = computeStamps(state, state.visualizedAnimations, trackIds || []);
          const stamp = state.player.stamp;
          const bounds = state.player.bounds;
          let nextStamp: number | undefined;
          if (respectBounds) {
            nextStamp = allStamps.find((s) => s > stamp && s <= bounds[1]);
          } else {
            nextStamp = allStamps.find((s) => s > stamp);
          }
          if (nextStamp !== undefined) {
            state.player = reset(state.player, nextStamp);
          }
        }),
      );
    },
    // Skip to the previous keyframe
    skipToPrevKeyframe: (trackIds?: string[], respectBounds?: boolean) => {
      set(
        produce((state: AnimationData) => {
          const allStamps = computeStamps(state, state.visualizedAnimations, trackIds || []);
          const stamp = state.player.stamp;
          const bounds = state.player.bounds;
          let prevStamp: number | undefined;
          if (respectBounds) {
            prevStamp = allStamps.reverse().find((s) => s < stamp && s >= bounds[0]);
          } else {
            prevStamp = allStamps.reverse().find((s) => s < stamp);
          }
          if (prevStamp !== undefined) {
            state.player = reset(state.player, prevStamp);
          }
        }),
      );
    },
    nextKeyframeTime: (
      state: AnimationData,
      trackIds?: string[],
      respectBounds?: boolean,
    ): number | undefined => {
      const allStamps = computeStamps(state, state.visualizedAnimations, trackIds || []);
      const stamp = state.player.stamp;
      const bounds = state.player.bounds;
      const nextStamp = respectBounds
        ? allStamps.find((s) => s > stamp && s <= bounds[1])
        : allStamps.find((s) => s > stamp);
      return nextStamp;
    },
    prevKeyframeTime: (
      state: AnimationData,
      trackIds?: string[],
      respectBounds?: boolean,
    ): number | undefined => {
      const allStamps = computeStamps(state, state.visualizedAnimations, trackIds || []);
      const stamp = state.player.stamp;
      const bounds = state.player.bounds;
      const nextStamp = respectBounds
        ? allStamps.reverse().find((s) => s < stamp && s >= bounds[0])
        : allStamps.reverse().find((s) => s < stamp);
      return nextStamp;
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
    initAnimationSubscriptions: () => {
      const updatePlayerInner = get().updatePlayer;
      const updateValues = get().updateValues;

      // If the time changes, check if it matches an existing keyframe and
      // set the current selected keyframe
      const unsubs = [
        api.subscribe(
          (state) => ({
            running: state.player.running,
            stamp: state.player.stamp,
            keyframes: state.animations[state.activeAnimation]?.frames,
          }),
          ({ running, stamp, keyframes }) => {
            if (running) {
              // The animation is running, so don't select any keyframe
              set({ selectedKeyframe: undefined });
            } else {
              // The animation isn't running, so select the keyframe that matches the current time
              // If none match, return undefined
              const selectedKeyframe = Array.from(keyframes.values()).find(
                (keyframe: Keyframe) => keyframe?.stamp === stamp,
              );
              set({ selectedKeyframe: selectedKeyframe?.id });
            }
          },
          {
            equalityFn: (current: StampAndKeyframes, previous: StampAndKeyframes) =>
              current.stamp === previous.stamp && current.keyframes === previous.keyframes,
          },
        ),

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
            Array.from(trackInterpolators.entries()).forEach(([key, trackInterpolator]) => {
              result.set(key, trackInterpolator(stamp));
            });
            updateValues(result);
          },
          { equalityFn: (current, previous) => current.stamp === previous.stamp },
        ),

        // Generates an intermediate version of the animation that can be used to more easily
        // identify changes for each track, used for generating track interpolators in unsub4b
        api.subscribe(
          (state) => state.animations[state.activeAnimation],
          (animation: Animation) => {
            const cache = computeAnimationCache(animation);
            set({ animationCache: cache });
          },
          { equalityFn: shallow },
        ),

        api.subscribe(
          (state: AnimationData) => ({
            trackIds: state.animations[state.activeAnimation].trackOrder,
            subscribes: state.trackSubscribers,
          }),
          ({ trackIds, subscribes }) => {
            // Clear the previous subscriptions for each track
            subscribes.forEach((trackUnsub) => {
              trackUnsub();
            });
            // Creat new subscriptions
            const newSubscribes = trackIds.map((trackId) => {
              return api.subscribe(
                // Monitor changes in instances, track, [all] frames and [all] points
                (state: AnimationData) => ({
                  instances: state.animations[state.activeAnimation].instances,
                  cache: state.animationCache.get(trackId),
                  duration: state.animations[state.activeAnimation].duration,
                  animatableValue:
                    state.animatables[
                      Object.values(state.controls).find((control) => control.writeId === trackId)
                        ?.readId ?? ""
                    ],
                }),
                ({ cache, instances, duration, animatableValue }) => {
                  // if (!track) return;
                  if (!cache) return;
                  const newVals = new Map<string, RawValue | undefined>();
                  const newTrackInterpolators = new Map<string, TrackInterpolator>();
                  let newViolations: Violation[] = [];
                  Object.keys(instances).forEach((namespace) => {
                    const lookup = getLookup(namespace, trackId);
                    const trackInterp = computeTrackInterpolator(cache, instances[namespace]);
                    newTrackInterpolators.set(lookup, trackInterp);
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
                    trackInterpolators: new Map([
                      ...state.trackInterpolators,
                      ...newTrackInterpolators,
                    ]),
                    values: new Map([...state.values, ...newVals]),
                    violations: { ...state.violations, [trackId]: newViolations },
                  }));
                },
                {
                  equalityFn: (current: TrackAndCacheData, previous: TrackAndCacheData) => {
                    // We avoid some computation by subscribing to the cache, isntead of the track
                    // that just computes an intermediate value that is tracked.
                    if (!current.cache || !previous.cache) return true;
                    return (
                      current.duration === previous.duration &&
                      shallow(current.track, previous.track) &&
                      shallow(current.cache, previous.cache) &&
                      shallow(current.instances, previous.instances) &&
                      shallow(current.animatableValue, previous.animatableValue)
                    );
                  },
                },
              );
            });

            set({ trackSubscribers: newSubscribes });
          },
          {
            equalityFn: (current: TrackIdsAndSubscribes, previous: TrackIdsAndSubscribes) =>
              shallow(current.trackIds, previous.trackIds),
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

interface StampAndKeyframes {
  running: boolean;
  stamp: number;
  keyframes: Map<string, Keyframe>;
}

interface TrackIdsAndSubscribes {
  trackIds: string[];
  subscribes: (() => void)[];
}

interface TrackAndCacheData {
  track?: Track;
  cache?: { stamp: number; value: RawValue }[];
  instances: Record<string, InstanceInfo>;
  duration: number;
  animatableValue?: AnimatableValue;
}
