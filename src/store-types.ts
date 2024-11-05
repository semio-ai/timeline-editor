import { type RawValue, type AnimatableValue } from "@semio/utils";
import { TimeDisplay } from "@semio/ui";
import {
  Keypoint,
  Track,
  Animation,
  AnimationInterpolator,
  Violation,
  Graph,
  ProcessNode,
  Control,
  StoredAnimation,
} from "./types";

export interface AnimationData {
  // Current values (output of interpolator)
  values: Map<string, RawValue | undefined>;
  // Current set of track interpolators
  trackInterpolators: AnimationInterpolator;
  // Active animation
  activeAnimation: string;
  // All animations loaded in the project
  animations: Record<string, Animation>;
  // All tracks loaded in the project
  tracks: Record<string, Track<RawValue>>;
  // A timer for tracking time.
  // player: Player;
  // Selected Keyframe, if any
  selectedKeyframe?: string;
  // Duration of the playback region, in milliseconds
  duration: number;
  // Overall Framerate of all animations
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
  // Some configurable preferences
  preferences: {
    hoverDashedLine: boolean;
    dataPreviews: boolean;
  };
  /*
    A set of unsubscribers for individual tracks (subscribers listen to changes in the track)
    These are used internally to update the interpolators when the animation structure changes
    and should not be modified directly.
  */
  trackSubscribers: (() => void)[];
  animationSubscribers: (() => void)[];
  // A set of violations that have been detected in the animation, indexed by track id
  violations: Record<string, Violation[]>;

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
  createNewDefaultAnimation: () => void;
  // Update the animation data
  addAnimation: (animation: unknown) => void;
  removeAnimation: (animationId: string) => void;
  // Update a keypoint by track and keyframe/time in the animation
  updateKeypoint: (trackId: string, keypoint: Partial<Keypoint<RawValue>>) => void;
  // Remove multiple keypoints at once
  updateKeypoints: (
    keypoints: { trackId: string; keypoint: Partial<Keypoint<RawValue>> }[],
  ) => void;
  // Add a new keypoint to a track
  createKeypoint: (trackId: string, keypoint: Partial<Keypoint<RawValue>>) => void;
  // Create multiple keypoints at once
  createKeypoints: (
    keypoints: { trackId: string; keypoint: Partial<Keypoint<RawValue>> }[],
  ) => void;
  // Update a track's data (other than id and points)
  updateTrack: (track: Partial<Track<RawValue>>) => void;
  // Remove a keypoint from the animation
  removeKeypoint: (trackId: string, keypointId: string) => void;
  // Remove multiple keypoints at once
  removeKeypoints: (keypoints: { trackId: string; keypointId: string }[]) => void;
  // Add a track to the animation
  createTrack: (track: Partial<Track<RawValue>>, animationId?: string) => void;
  // Remove a track from the animation
  removeTrack: (trackId: string, animationId?: string) => void;
  // Set the timescale of the animation playback
  // updateTimescale: (speed: number) => void;
  // Set the time of the animation
  // resetPlayer: (time?: number) => void;
  // Play the animation
  // playPlayer: (speed?: number) => void;
  // Pause the animation
  // pausePlayer: () => void;
  // Update the timer
  // updatePlayer: (coldStart?: boolean) => void;
  // Set the player bounds
  // updatePlayerBounds: (start: number, end: number) => void;
  // Update one bound of the player
  // updatePlayerBound: (bound: "start" | "end", time?: number) => void;
  // Set the player viewport
  // updatePlayerViewport: (start: number, end: number) => void;
  // Seek the viewport to center the player at a time
  // updatePlayerViewportCenter: (time?: number) => void;
  // Update one bound of the player viewport
  // updatePlayerViewportBound: (bound: "start" | "end", time: number) => void;
  // Skip to the next keyframe (optionally filter by track)
  skipToNextKeyframe: (
    animationId: string,
    namespaceIds: string[],
    trackIds: string[],
    respectBounds?: boolean,
  ) => void;
  // Skip to the previous keyframe (optionally filter by track)
  skipToPrevKeyframe: (
    animationId: string,
    namespaceIds: string[],
    trackIds: string[],
    respectBounds?: boolean,
  ) => void;
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
  // Initialize interpolator generation. Returns a function to cancel the subscriptions
  initAnimationSubscriptions: () => () => void;
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
  updatePreview: (evaluator: (preview: Preview) => boolean, preview: Partial<Preview>) => void;
  // Macro for updating/removing the hoverpoint preview
  updateHoverpointPreview: (value: number | null) => void;
  // Getter for the stored animation
  getStorableAnimation: (animationId: string) => StoredAnimation;
  // Getter for all stored animations
  getAnimationsToSave: () => StoredAnimation[];

  // THE FOLLOWING ENTRIES SHOULD BE REMOVED FOLLOWING THE DEMO
  setValue: (animatableId: string, namespace: string, value: RawValue) => void;
  setValues: (updates: { animatableId: string; namespace: string; value: RawValue }[]) => void;
  updateControlColor: (controlId: string, color: string) => void;
  setPreferences: (preferences: Partial<AnimationData["preferences"]>) => void;
}

export type AnimationStoreSetter = (
  partial:
    | (AnimationData & AnimationActions)
    | Partial<AnimationData & AnimationActions>
    | ((
        state: AnimationData & AnimationActions,
      ) => (AnimationData & AnimationActions) | Partial<AnimationData & AnimationActions>),
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
