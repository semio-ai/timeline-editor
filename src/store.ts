import { reset, update, play, pause, setBounds, RawValue } from "@semio/utils";
import { TimeDisplay } from "@semio/ui";
import { subscribeWithSelector } from "zustand/middleware";
import { produce, enableMapSet } from "immer";
import { create } from "zustand";
import { Keyframe, Keypoint, Track } from "./types";
import { createKeyframe } from "./actions/create-keyframe";
import { createAutoKeyframe } from "./actions/create-auto-keyframe";
import { removeKeyframe } from "./actions/remove-keyframe";
import { updateKeyframeStamp } from "./actions/update-keyframe-stamp";
import {
  AnimationData,
  AnimationActions,
  AnimationStoreGetter,
  AnimationStoreSetter,
  Preview,
} from "./store-types";
import { createKeypoint } from "./actions/create-keypoint";
import { updateKeypointValue } from "./actions/update-keypoint-value";
import { removeKeypoint } from "./actions/remove-keypoint";
import { createTrack } from "./actions/create-track";
import { removeTrack } from "./actions/remove-track";
import { moveKeypoint } from "./actions/move-keypoint";
import { computeStamps } from "./actions/compute-stamps";
import { createDefaultState } from "./actions/create-default-state";
import { updateAnimationKeypoint } from "./actions/update-animation-keypoint";
import { updateTrack } from "./actions/update-track";
import { addAnimation } from "./actions/add-animation";

enableMapSet();

export const AnimationSlice = (
  set: AnimationStoreSetter,
  get: AnimationStoreGetter,
) => {
  return {
    ...createDefaultState(),
    createKeyframe: (keyframe: Partial<Keyframe>, animationId?: string) => {
      set(
        produce((state: AnimationData): void => {
          createKeyframe(state, animationId ?? state.activeAnimation, keyframe);
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
          removeKeyframe(
            state,
            keyframeId,
            animationId ?? state.activeAnimation,
          );
        }),
      );
    },
    setActiveAnimation: (animationId: string) => {
      set({ activeAnimation: animationId });
    },
    visualizeAnimation: (animationId: string) => {
      set(
        produce((state: AnimationData): void => {
          state.visualizedAnimations = [
            ...state.visualizedAnimations,
            animationId,
          ];
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
    updateKeyframeStamp: (
      keyframeId: string,
      stamp: number,
      animationId?: string,
    ) => {
      set(
        produce((state: AnimationData): void => {
          updateKeyframeStamp(
            state,
            animationId ?? state.activeAnimation,
            keyframeId,
            stamp,
          );
        }),
      );
    },
    createKeypoint: (
      trackId: string,
      point: Partial<Keypoint<RawValue>>,
      animationId?: string,
    ) => {
      set(
        produce((state: AnimationData): void => {
          createKeypoint(
            state,
            animationId ?? state.activeAnimation,
            trackId,
            point,
          );
        }),
      );
    },
    updateKeypointValue: (
      keypointId: string,
      value: RawValue,
      animationId?: string,
    ) => {
      set(
        produce((state: AnimationData): void => {
          updateKeypointValue(
            state,
            animationId ?? state.activeAnimation,
            keypointId,
            value,
          );
        }),
      );
    },
    updateTrack: (
      trackId: string,
      data: Omit<Track, "id" | "points">,
      animationId?: string,
    ) => {
      set(
        produce((state: AnimationData) => {
          updateTrack(
            state,
            animationId || state.activeAnimation,
            trackId,
            data,
          );
        }),
      );
    },
    removeKeypoint: (keypointId: string, animationId?: string) => {
      set(
        produce((state: AnimationData): void => {
          removeKeypoint(
            state,
            animationId ?? state.activeAnimation,
            keypointId,
          );
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
    updatePlayer: () => {
      set((state: AnimationData) => ({
        player: update(state.player, state.duration),
      }));
    },
    // Set the player bounds
    updatePlayerBounds: (start: number, end: number) => {
      set((state: AnimationData) => ({
        player: setBounds(state.player, [start, end]),
      }));
    },
    updatePlayerBound: (bound: "start" | "end", time: number) => {
      set((state: AnimationData) => {
        if (bound === "start" && state.player.bounds[1] <= time) {
          return {
            player: setBounds(state.player, [state.player.bounds[1], time]),
          };
        } else if (bound === "end" && state.player.bounds[0] >= time) {
          return {
            player: setBounds(state.player, [time, state.player.bounds[0]]),
          };
        } else if (bound === "start") {
          return {
            player: setBounds(state.player, [time, state.player.bounds[1]]),
          };
        } else {
          return {
            player: setBounds(state.player, [state.player.bounds[0], time]),
          };
        }
      });
    },
    // Skip to the next keyframe
    skipToNextKeyframe: (trackIds?: string[], respectBounds?: boolean) => {
      set(
        produce((state: AnimationData) => {
          const allStamps = computeStamps(
            state,
            state.visualizedAnimations,
            trackIds || [],
          );
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
          const allStamps = computeStamps(
            state,
            state.visualizedAnimations,
            trackIds || [],
          );
          const stamp = state.player.stamp;
          const bounds = state.player.bounds;
          let prevStamp: number | undefined;
          if (respectBounds) {
            prevStamp = allStamps
              .reverse()
              .find((s) => s < stamp && s >= bounds[0]);
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
      const allStamps = computeStamps(
        state,
        state.visualizedAnimations,
        trackIds || [],
      );
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
      const allStamps = computeStamps(
        state,
        state.visualizedAnimations,
        trackIds || [],
      );
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
    initPlayerInterval: () => {
      if (get().playerInterval) {
        window.clearInterval(get().playerInterval);
      }
      const updatePlayer = get().updatePlayer;
      const interval = window.setInterval(() => {
        updatePlayer();
      }, 15);
      set({ playerInterval: interval });
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
  };
};

export const useDefaultAnimationStore = create<
  AnimationData & AnimationActions
>()(subscribeWithSelector((set, get) => ({ ...AnimationSlice(set, get) })));

export type AnimationStore = typeof useDefaultAnimationStore;
