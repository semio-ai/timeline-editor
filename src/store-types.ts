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
  Preview,
} from "./types";

/**
 * Interface representing the data structure for animation.
 */
export interface AnimationData {
  /**
   * Current values (output of interpolator).
   */
  values: Map<string, RawValue | undefined>;
  /**
   * Current set of track interpolators.
   */
  trackInterpolators: AnimationInterpolator;
  /**
   * Active animation.
   */
  activeAnimation: string;
  /**
   * All animations loaded in the project.
   */
  animations: Record<string, Animation>;
  /**
   * All tracks loaded in the project.
   */
  tracks: Record<string, Track<RawValue>>;
  /**
   * Selected Keyframe, if any.
   */
  selectedKeyframe?: string;
  /**
   * Duration of the playback region, in milliseconds.
   */
  duration: number;
  /**
   * Overall Framerate of all animations.
   */
  framerate: number;
  /**
   * Visualized Animations.
   */
  visualizedAnimations: string[];
  /**
   * Whether the sheet is expanded.
   */
  expanded: boolean;
  /**
   * Whether to show times as frames or seconds.
   */
  timeDisplay: TimeDisplay;
  /**
   * Player's interval.
   */
  playerInterval?: number;
  /**
   * Where the user is currently hovering in the timeline.
   */
  hoverpoint: number;
  /**
   * Previews for parts of the animation other than the current time.
   */
  previews: Preview[];
  /**
   * Some configurable preferences.
   */
  preferences: {
    hoverDashedLine: boolean;
    dataPreviews: boolean;
  };
  /**
   * A set of unsubscribers for individual tracks (subscribers listen to changes in the track).
   * These are used internally to update the interpolators when the animation structure changes
   * and should not be modified directly.
   */
  trackSubscribers: (() => void)[];
  /**
   * A set of unsubscribers for individual animations.
   */
  animationSubscribers: (() => void)[];
  /**
   * A set of violations that have been detected in the animation, indexed by track id.
   */
  violations: Record<string, Violation[]>;

  // THE FOLLOWING ENTRIES SHOULD BE REMOVED FOLLOWING THE DEMO
  activeGraph: string;
  graphs: Record<string, Graph>;
  nodes: Record<string, ProcessNode>;
  controls: Record<string, Control>;
  latestControl?: Control;
  animatables: Record<string, AnimatableValue>;
}

/**
 * Interface representing the actions that can be performed on the animation data.
 */
export interface AnimationActions {
  /**
   * Update all values in the store.
   * @param values - A map of values to update.
   */
  updateValues: (values: Map<string, RawValue | undefined>) => void;
  /**
   * Add a new keyframe to the animation.
   */
  createNewDefaultAnimation: () => void;
  /**
   * Update the animation data.
   * @param animation - The animation data to add.
   */
  addAnimation: (animation: unknown) => void;
  /**
   * Remove an animation by its ID.
   * @param animationId - The ID of the animation to remove.
   */
  removeAnimation: (animationId: string) => void;
  /**
   * Update a keypoint by track and keyframe/time in the animation.
   * @param trackId - The ID of the track.
   * @param keypoint - The keypoint data to update.
   */
  updateKeypoint: (trackId: string, keypoint: Partial<Keypoint<RawValue>>) => void;
  /**
   * Remove multiple keypoints at once.
   * @param keypoints - An array of keypoints to update.
   */
  updateKeypoints: (
    keypoints: { trackId: string; keypoint: Partial<Keypoint<RawValue>> }[],
  ) => void;
  /**
   * Add a new keypoint to a track.
   * @param trackId - The ID of the track.
   * @param keypoint - The keypoint data to create.
   */
  createKeypoint: (trackId: string, keypoint: Partial<Keypoint<RawValue>>) => void;
  /**
   * Create multiple keypoints at once.
   * @param keypoints - An array of keypoints to create.
   */
  createKeypoints: (
    keypoints: { trackId: string; keypoint: Partial<Keypoint<RawValue>> }[],
  ) => void;
  /**
   * Update a track's data (other than id and points).
   * @param track - The track data to update.
   */
  updateTrack: (track: Partial<Track<RawValue>>) => void;
  /**
   * Remove a keypoint from the animation.
   * @param trackId - The ID of the track.
   * @param keypointId - The ID of the keypoint to remove.
   */
  removeKeypoint: (trackId: string, keypointId: string) => void;
  /**
   * Remove multiple keypoints at once.
   * @param keypoints - An array of keypoints to remove.
   */
  removeKeypoints: (keypoints: { trackId: string; keypointId: string }[]) => void;
  /**
   * Add a track to the animation.
   * @param track - The track data to create.
   * @param animationId - The ID of the animation to add the track to.
   */
  createTrack: (track: Partial<Track<RawValue>>, animationId?: string) => void;
  /**
   * Remove a track from the animation.
   * @param trackId - The ID of the track to remove.
   * @param animationId - The ID of the animation to remove the track from.
   */
  removeTrack: (trackId: string, animationId?: string) => void;
  /**
   * Skip to the next keyframe (optionally filter by track).
   * @param animationId - The ID of the animation.
   * @param namespaceIds - An array of namespace IDs to filter by.
   * @param trackIds - An array of track IDs to filter by.
   * @param respectBounds - Whether to respect bounds.
   */
  skipToNextKeyframe: (
    animationId: string,
    namespaceIds: string[],
    trackIds: string[],
    respectBounds?: boolean,
  ) => void;
  /**
   * Skip to the previous keyframe (optionally filter by track).
   * @param animationId - The ID of the animation.
   * @param namespaceIds - An array of namespace IDs to filter by.
   * @param trackIds - An array of track IDs to filter by.
   * @param respectBounds - Whether to respect bounds.
   */
  skipToPrevKeyframe: (
    animationId: string,
    namespaceIds: string[],
    trackIds: string[],
    respectBounds?: boolean,
  ) => void;
  /**
   * Skip to the start of the current bounds.
   */
  skipToStart: () => void;
  /**
   * Skip to the end of the current bounds.
   */
  skipToEnd: () => void;
  /**
   * Set the duration of the animation.
   * @param duration - The duration to set.
   * @param animationId - The ID of the animation to update.
   */
  updateDuration: (duration: number, animationId?: string) => void;
  /**
   * Set the frame rate of the animation.
   * @param framerate - The frame rate to set.
   */
  updateFramerate: (framerate: number) => void;
  /**
   * Set the expanded state of the sheet.
   * @param expanded - Whether the sheet is expanded.
   */
  setExpanded: (expanded: boolean) => void;
  /**
   * Set the time display mode.
   * @param mode - The time display mode to set.
   */
  setTimeDisplay: (mode: TimeDisplay) => void;
  /**
   * Initialize interpolator generation. Returns a function to cancel the subscriptions.
   */
  initAnimationSubscriptions: () => () => void;
  /**
   * Set the hoverpoint.
   * @param hoverpoint - The hoverpoint to set.
   */
  setHoverpoint: (hoverpoint: number) => void;
  /**
   * Add an animation to the visualized set.
   * @param animationId - The ID of the animation to visualize.
   */
  visualizeAnimation: (animationId: string) => void;
  /**
   * Remove an animation from the visualized set.
   * @param animationId - The ID of the animation to unvisualize.
   */
  unvisualizeAnimation: (animationId: string) => void;
  /**
   * Set the active animation.
   * @param animationId - The ID of the animation to set as active.
   */
  setActiveAnimation: (animationId: string) => void;
  /**
   * Add a preview to the animation.
   * @param preview - The preview to add.
   */
  addPreview: (preview: Preview) => void;
  /**
   * Remove a preview from the animation.
   * @param evaluator - A function to evaluate which preview to remove.
   */
  removePreview: (evaluator: (preview: Preview) => boolean) => void;
  /**
   * Update a preview in the animation.
   * @param evaluator - A function to evaluate which preview to update.
   * @param preview - The preview data to update.
   */
  updatePreview: (evaluator: (preview: Preview) => boolean, preview: Partial<Preview>) => void;
  /**
   * Macro for updating/removing the hoverpoint preview.
   * @param value - The value to set for the hoverpoint preview.
   */
  updateHoverpointPreview: (value: number | null) => void;
  /**
   * Getter for the stored animation.
   * @param animationId - The ID of the animation to get.
   */
  getStorableAnimation: (animationId: string) => StoredAnimation;
  /**
   * Getter for all stored animations.
   */
  getAnimationsToSave: () => StoredAnimation[];

  // THE FOLLOWING ENTRIES SHOULD BE REMOVED FOLLOWING THE DEMO
  /**
   * Set the value of an animatable.
   * @param animatableId - The ID of the animatable.
   * @param namespace - The namespace of the value.
   * @param value - The value to set.
   */
  setValue: (animatableId: string, namespace: string, value: RawValue) => void;
  /**
   * Set multiple values of animatables.
   * @param updates - An array of updates to set.
   */
  setValues: (updates: { animatableId: string; namespace: string; value: RawValue }[]) => void;
  /**
   * Update the color of a control.
   * @param controlId - The ID of the control.
   * @param color - The color to set.
   */
  updateControlColor: (controlId: string, color: string) => void;
  /**
   * Set the preferences for the animation data.
   * @param preferences - The preferences to set.
   */
  setPreferences: (preferences: Partial<AnimationData["preferences"]>) => void;
}

/**
 * Type representing the setter function for the animation store.
 */
export type AnimationStoreSetter = (
  partial:
    | (AnimationData & AnimationActions)
    | Partial<AnimationData & AnimationActions>
    | ((
        state: AnimationData & AnimationActions,
      ) => (AnimationData & AnimationActions) | Partial<AnimationData & AnimationActions>),
  replace?: false | undefined,
) => void;

/**
 * Type representing the getter function for the animation store.
 */
export type AnimationStoreGetter = () => AnimationData & AnimationActions;
