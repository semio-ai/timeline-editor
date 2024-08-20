import { type Player, type RawValue, type AnimatableValue } from "@semio/utils";
import { TimeDisplay } from "@semio/ui";
import { Keypoint, Track, Animation, AnimationInterpolator } from "./types";
import { Graph, ProcessNode, Control } from "./temp-duplicate-types";

export interface AnimationData {
  // Current values (output of interpolator)
  values: Map<string, RawValue | undefined>;
  // Current interpolator
  interpolator: AnimationInterpolator;
  // Active animation
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
  // Previews for parts of the animation other than the current time
  previews: Preview[];

  // THE FOLLOWING ENTRIES SHOULD BE REMOVED FOLLOWING THE DEMO
  activeGraph: string;
  graphs: Record<string, Graph>;
  nodes: Record<string, ProcessNode>;
  controls: Record<string, Control>;
  latestControl?: Control;
  animatables: Record<string, AnimatableValue>;
}

export interface AnimationActions {
  // Update all values in the store
  updateValues: (values: Map<string, RawValue | undefined>) => void;
  // Add a new keyframe to the animation
  createKeyframe: (
    keyframe: Partial<Keyframe>,
    animationId?: string,
    fillPoints?: boolean,
  ) => void;
  // Add a new keyframe to the animation at the current time;
  createAutoKeyframe: () => void;
  // Remove a keyframe from the animation
  removeKeyframe: (keyframeId: string, animationId?: string) => void;
  // Update the animation data
  addAnimation: (animation: unknown) => void;
  removeAnimation: (animationId: string) => void;
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
  // Set the player viewport
  updatePlayerViewport: (start: number, end: number) => void;
  // Update one bound of the player viewport
  updatePlayerViewportBound: (bound: "start" | "end", time: number) => void;
  // The current next keyframe time (optionally filter by track)
  nextKeyframeTime: (
    state: AnimationData,
    trackIds?: string[],
  ) => number | undefined;
  // The current previous keyframe time (optionally filter by track)
  prevKeyframeTime: (
    state: AnimationData,
    trackIds?: string[],
  ) => number | undefined;
  // Skip to the next keyframe (optionally filter by track)
  skipToNextKeyframe: (trackIds?: string[]) => void;
  // Skip to the previous keyframe (optionally filter by track)
  skipToPrevKeyframe: (trackIds?: string[]) => void;
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
  // Initialize interpolator generation
  initInterpolatorGeneration: () => void;
  // Set the hoverpoint
  setHoverpoint: (hoverpoint: number) => void;
  // Add an animation to the visualized set
  visualizeAnimation: (animationId: string) => void;
  // Remove an animation from the visualized set
  unvisualizeAnimation: (animationId: string) => void;
  // Set the active animation
  setActiveAnimation: (animationId: string) => void;
  // Add a preview to the animation
  addPreview: (preview: Preview) => void;
  // Remove a preview from the animation
  removePreview: (evaluator: (preview: Preview) => boolean) => void;
  // Update a preview in the animation
  updatePreview: (
    evaluator: (preview: Preview) => boolean,
    preview: Partial<Preview>,
  ) => void;

  // THE FOLLOWING ENTRIES SHOULD BE REMOVED FOLLOWING THE DEMO
  setValue: (animatedId: string, namespace: string, value: RawValue) => void;
  updateControlColor: (controlId: string, color: string) => void;
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

export interface Preview {
  stamp: number;
  label: string;
  semanticTime: SemanticTime;
}

export enum SemanticTime {
  Current = "current",
  Duration = "duration",
  Forward = "forward",
  Backward = "backward",
  BoundsStart = "bounds-start",
  BoundsEnd = "bounds-end",
  Hover = "hover",
}
