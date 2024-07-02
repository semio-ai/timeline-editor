import { type Player } from "@semio/utils";
import { TimeDisplay } from "@semio/ui";
import { Keypoint, Track, Animation } from "./types";

export interface AnimationData {
  activeAnimation: string;
  // All animations loaded in the project
  animations: Record<string, Animation>;
  // A timer for tracking time.
  player: Player;
  // Selected Keyframe, if any
  selectedKeyframe?: string;
  // Overall duration of all animations
  duration: number;
  // Overall Framrate of all animations
  framerate: number;
  // Visualized Animations
  visualizedAnimations: string[];
  // Whether the sheet is expanded
  expanded: boolean;
  // Whether to show times as frames or seconds
  timeDisplay: TimeDisplay;
}

export interface AnimationActions {
  // Add a new keyframe to the animation
  createKeyframe: (keyframe: Partial<Keyframe>, animationId?: string) => void;
  // Add a new keyframe to the animation at the current time;
  createAutoKeyframe: () => void;
  // Remove a keyframe from the animation
  removeKeyframe: (keyframeId: string, animationId?: string) => void;
  // Update a keyframe time in the animation
  updateKeyframeStamp: (
    keyframeId: string,
    stamp: number,
    animationId?: string,
  ) => void;
  // Add a new keypoint to a keyframe/track
  createKeypoint: (
    trackId: string,
    point: Partial<Keypoint<number | string>>,
    animationId?: string,
  ) => void;
  // Set a keypoint value
  updateKeypointValue: (
    keypointId: string,
    value: number | string,
    animationId?: string,
  ) => void;
  // Remove a keypoint from the animation
  removeKeypoint: (keypointId: string, animationId?: string) => void;
  // Add a track to the animation
  createTrack: (track: Partial<Track>, animationId?: string) => void;
  // Remove a track from the animation
  removeTrack: (trackId: string, animationId?: string) => void;
  // Move a waypoint to a new keyframe or track;
  moveKeypoint: (
    keypointId: string,
    keyframeOrTime: string | number,
    trackId: string,
    animationId?: string,
  ) => void;
  // Set the timescale of the animation playback
  updateTimescale: (speed: number) => void;
  // Set the time of the animation
  resetPlayer: (time?: number) => void;
  // Play the animation
  playPlayer: (speed?: number) => void;
  // Pause the animation
  pausePlayer: () => void;
  // Update the timer
  updatePlayer: () => void;
  // Set the player bounds
  updatePlayerBounds: (start: number, end: number) => void;
  // Skip to the next keyframe
  nextKeyframe: () => void;
  // Skip to the previous keyframe
  prevKeyframe: () => void;
  // Set the duration of the animation
  updateDuration: (duration: number) => void;
  // Set the frame rate of the animation
  updateFramerate: (framerate: number) => void;
  // Set the exanded state of the sheet
  setExpanded: (expanded: boolean) => void;
  // Set the time display mode
  setTimeDisplay: (mode: TimeDisplay) => void;
}

export type AnimationStoreSetter = (
  partial:
    | (AnimationData & AnimationActions)
    | Partial<AnimationData & AnimationActions>
    | ((
        state: AnimationData & AnimationActions,
      ) =>
        | (AnimationData & AnimationActions)
        | Partial<AnimationData & AnimationActions>),
  replace?: boolean,
) => void;

export type AnimationStoreGetter = () => AnimationData & AnimationActions;
