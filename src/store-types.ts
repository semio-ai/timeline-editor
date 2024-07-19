import { type Player, type RawValue } from "@semio/utils";
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
  // Player's interval
  playerInterval?: number;
  // Where the user is currently hovering in the timeline
  hoverpoint: number;
}

export interface AnimationActions {
  // Add a new keyframe to the animation
  createKeyframe: (keyframe: Partial<Keyframe>, animationId?: string) => void;
  // Add a new keyframe to the animation at the current time;
  createAutoKeyframe: () => void;
  // Remove a keyframe from the animation
  removeKeyframe: (keyframeId: string, animationId?: string) => void;
  // Update the animation data
  addAnimation: (animation: Partial<Animation>) => void;
  // Update a keypoint by track and keyframe/time in the animation
  updateAnimationKeypoint: (
    keyframeOrTime: string | number,
    trackId: string,
    value: RawValue,
    animationId?: string,
  ) => void;
  // Update a keyframe time in the animation
  updateKeyframeStamp: (
    keyframeId: string,
    stamp: number,
    animationId?: string,
  ) => void;
  // Add a new keypoint to a keyframe/track
  createKeypoint: (
    trackId: string,
    point: Partial<Keypoint<RawValue>>,
    animationId?: string,
  ) => void;
  // Set a keypoint value
  updateKeypointValue: (
    keypointId: string,
    value: RawValue,
    animationId?: string,
  ) => void;
  // Update a track's data (other than id and points)
  updateTrack: (
    trackId: string,
    data: Omit<Track, "id" | "points">,
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
  // Update one bound of the player
  updatePlayerBound: (bound: "start" | "end", time: number) => void;
  // The current next keyframe time
  nextKeyframeTime: () => number | undefined;
  // The current previous keyframe time
  prevKeyframeTime: () => number | undefined;
  // Skip to the next keyframe
  skipToNextKeyframe: () => void;
  // Skip to the previous keyframe
  skipToPrevKeyframe: () => void;
  // Skip to the start of the current bounds
  skipToStart: () => void;
  // Skip to the end of the current bounds
  skipToEnd: () => void;
  // Set the duration of the animation
  updateDuration: (duration: number, animationId?: string) => void;
  // Set the frame rate of the animation
  updateFramerate: (framerate: number) => void;
  // Set the exanded state of the sheet
  setExpanded: (expanded: boolean) => void;
  // Set the time display mode
  setTimeDisplay: (mode: TimeDisplay) => void;
  // Initialize the player updates
  initPlayerInterval: () => void;
  // Set the hoverpoint
  setHoverpoint: (hoverpoint: number) => void;
  // Add an animation to the visualized set
  visualizeAnimation: (animationId: string) => void;
  // Remove an animation from the visualized set
  unvisualizeAnimation: (animationId: string) => void;
  // Set the active animation
  setActiveAnimation: (animationId: string) => void;
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
