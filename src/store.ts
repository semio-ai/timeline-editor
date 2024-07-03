import { newPlayer, reset, update, play, pause, setBounds } from "@semio/utils";
import { TimeDisplay } from "@semio/ui";
import { subscribeWithSelector } from "zustand/middleware";
import { produce, enableMapSet } from "immer";
import { create } from "zustand";
import { Keyframe, Keypoint, Track } from "./types";
import { createDefaultAnimation } from "./actions/create-default-animation";
import { createKeyframe } from "./actions/create-keyframe";
import { createAutoKeyframe } from "./actions/create-auto-keyframe";
import { removeKeyframe } from "./actions/remove-keyframe";
import { updateKeyframeStamp } from "./actions/update-keyframe-stamp";
import {
  AnimationData,
  AnimationActions,
  AnimationStoreGetter,
  AnimationStoreSetter,
} from "./store-types";
import { createKeypoint } from "./actions/create-keypoint";
import { updateKeypointValue } from "./actions/update-keypoint-value";
import { removeKeypoint } from "./actions/remove-keypoint";
import { createTrack } from "./actions/create-track";
import { removeTrack } from "./actions/remove-track";
import { moveKeypoint } from "./actions/move-keypoint";
import { computeStamps } from "./actions/compute-stamps";

enableMapSet();

export const AnimationSlice = (
  set: AnimationStoreSetter,
  get: AnimationStoreGetter,
) => {
  const defaultAnimation = createDefaultAnimation();
  return {
    activeAnimation: defaultAnimation.id,
    animations: { [defaultAnimation.id]: defaultAnimation },
    visualizedAnimations: [defaultAnimation.id],
    player: newPlayer(),
    duration: defaultAnimation.duration,
    framerate: 24,
    selectedKeyframe: undefined,
    expanded: false,
    timeDisplay: TimeDisplay.SECONDS,
    playerInterval: undefined,
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
      point: Partial<Keypoint<number | string>>,
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
      value: number | string,
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
      set(
        produce((state: AnimationData) => {
          reset(state.player, time);
        }),
      );
    },
    // Play the animation
    playPlayer: (speed?: number) => {
      set(
        produce((state: AnimationData) => {
          play(state.player, speed);
        }),
      );
    },
    // Pause the animation
    pausePlayer: () => {
      set(
        produce((state: AnimationData) => {
          pause(state.player);
        }),
      );
    },
    // Update the timer
    updatePlayer: () => {
      set(
        produce((state: AnimationData) => {
          update(state.player, state.duration);
        }),
      );
    },
    // Set the player bounds
    updatePlayerBounds: (start: number, end: number) => {
      set(
        produce((state: AnimationData) => {
          setBounds(state.player, [start, end]);
        }),
      );
    },
    // Skip to the next keyframe
    nextKeyframe: () => {
      set(
        produce((state: AnimationData) => {
          const allStamps = computeStamps(state, state.visualizedAnimations);
          const stamp = state.player.stamp;
          const bounds = state.player.bounds;
          const nextStamp = allStamps.find((s) => s > stamp && s <= bounds[1]);
          if (nextStamp) {
            state.player = reset(state.player, nextStamp);
          }
        }),
      );
    },
    // Skip to the previous keyframe
    prevKeyframe: () => {
      set(
        produce((state: AnimationData) => {
          const allStamps = computeStamps(state, state.visualizedAnimations);
          const stamp = state.player.stamp;
          const bounds = state.player.bounds;
          const nextStamp = allStamps
            .reverse()
            .find((s) => s < stamp && s >= bounds[0]);
          if (nextStamp) {
            state.player = reset(state.player, nextStamp);
          }
        }),
      );
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
      set({
        playerInterval: window.setInterval(() => {
          get().updatePlayer();
        }, 15),
      });
    },
  };
};

export const useDefaultAnimationStore = create<
  AnimationData & AnimationActions
>()(subscribeWithSelector((set, get) => ({ ...AnimationSlice(set, get) })));

export type AnimationStore = typeof useDefaultAnimationStore;
