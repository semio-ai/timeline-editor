import type { RawValue, AnimatableValue, StoreSubscribeWithSelector, Write } from "@semio/utils";
import { TimeDisplay } from "@semio/ui";
import type { StoreApi } from "zustand";
import type {
  Animation,
  StoredAnimation,
  Preview,
  Source,
  DragState,
  DragStartInput,
  DragUpdateInput,
  ValueDragStartInput,
  ValueDragUpdateInput,
  HandleDragStartInput,
  HandleDragUpdateInput,
  SourceRow,
  MarkerPoint,
  View,
  VisibleSourceRowIds,
  Namespace,
  DerivedSnapshot,
} from "./types";
import { StandardTransitionType, TransitionDirective, TransitionPairing } from "./types";
import type { SelectionState } from "./types/util/selection-state";
import type { SimpleKeypoint, SimpleTrack } from "./types/data/simple-track";

export { TransitionDirective };

export type TransitionPreference = StandardTransitionType | TransitionDirective;
export type TransitionPatch = Partial<{
  in: TransitionPreference;
  out: TransitionPreference;
  pairing: TransitionPairing;
}>;

export interface EditorViewState {
  activeViewId?: string;
  viewOrder: string[];
  views: (Partial<View> & { id: string })[];
}

export interface NewKeyTransitionPreferences {
  in: TransitionPreference;
  out: TransitionPreference;
  pairing: TransitionPairing;
}

export interface NewKeyPreferences {
  transitions: NewKeyTransitionPreferences;
}

export interface AnimationPreferencesPatch {
  hoverDashedLine?: boolean;
  dataPreviews?: boolean;
  controlStripMode?: "keySkip" | "properties";
  newKeyDefaults?: {
    transitions?: Partial<NewKeyTransitionPreferences>;
  };
}

/**
 * Interface representing the data structure for animation.
 */
export interface AnimationData {
  derivedSnapshot?: DerivedSnapshot;
  /**
   * A record of animation instances and their namespaces, used for specifying how
   * values are written into `useValuesStore` without overriding others.
   */
  namespaces: Record<string, Namespace>;
  /**
   * All animations loaded in the project.
   */
  animations: Record<string, Animation>;
  /**
   * All tracks loaded in the project. Each track must be scalar-only (number, string, or boolean)
   * after flattening composite animatables into per-component records.
   */
  tracks: Record<string, SimpleTrack>;
  /**
   * Duration of the playback region, in milliseconds.
   */
  duration: number;
  /**
   * Overall Framerate of all animations.
   */
  framerate: number;
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
   * Previews for parts of the animation other than the current time.
   */
  previews: Preview[];

  /**
   * Keypoint-based selection state scoped to a single animation instance.
   * Replaces the previous combination of `selectionState` + `activeAnimationInstance`.
   */
  selectionState: SelectionState;

  /**
   * Source row ID currently hovered/emphasized. Transient, single-row, no hierarchy.
   * Drives track-colored background tint in the track list and canvas band opacity.
   */
  emphasisRowId: string | null;

  /**
   * Some configurable preferences.
   */
  preferences: {
    hoverDashedLine: boolean;
    dataPreviews: boolean;
    newKeyDefaults: NewKeyPreferences;
    /**
     * Which controls appear in the right-side strip of each track row.
     * - "keySkip": Skip-back, keypoint add/remove, skip-forward (default)
     * - "properties": Visibility, mute, lock toggles
     */
    controlStripMode: "keySkip" | "properties";
  };
  // THE FOLLOWING ENTRIES SHOULD BE REMOVED FOLLOWING THE DEMO
  animatables: Record<string, AnimatableValue>;

  /**
   * Current drag state for virtual dragging functionality.
   */
  dragState?: DragState;
  /**
   * Views for different windows of the animation editor
   */
  editorViews: Record<string, View>;
  /**
   * Ordered editor view ids for toolbar/dropdown rendering.
   */
  editorViewOrder: string[];
  /**
   * Currently active editor view id.
   */
  activeEditorViewId?: string;
  /**
   * Global set of instanced track sources
   */
  instancedTrackSources: Record<string, SourceRow>;
  /**
   * Full hierarchical source tree (entity → instance → groups → tracks).
   * Used by rendering pipeline, sourceRowIds, and derived snapshot.
   * Entity/instance groups are included when multiple entities or instances exist.
   */
  globalSourceTree: Source[];
  /**
   * Global source row IDs shared across all views
   */
  sourceRowIds: VisibleSourceRowIds;
  /**
   * View-specific source row visibility derived from each view's hidden track settings.
   */
  sourceRowIdsByView: Record<string, VisibleSourceRowIds>;
  /**
   * Incremented whenever track metadata changes so subscriptions can detect updates
   * without diffing the entire track map.
   */
  tracksRevision?: number;
}

/**
 * Interface representing the actions that can be performed on the animation data.
 */
export interface AnimationActions {
  /**
   * Click a marker - Points-based with automatic instance handling.
   * @param clickedPoints - Selection points for the marker (pre-filtered for selectable).
   * @param rowId - The source row containing the marker.
   * @param markerId - The marker identifier within the row.
   * @param shift - Whether the shift key is pressed.
   * @param mod - Whether a modifier key (ctrl/cmd) is pressed.
   */
  clickMarker: (
    clickedPoints: MarkerPoint[],
    rowId: string,
    markerId: string,
    shift?: boolean,
    mod?: boolean,
  ) => void;
  /**
   * Click a transition segment (row-wide selection).
   * Operates on the entire set of foreground keypoints in the row for the current selectionState.instanceId.
   * Segment clicks never modify the selection reference. Shift acts like a plain click.
   * @param rowId - The source row being clicked.
   * @param segmentId - The identifier of the segment clicked (used for telemetry; selection is row-wide).
   * @param shift - Whether the shift key is pressed.
   * @param mod - Whether a modifier key (ctrl/cmd) is pressed.
   */
  clickLine: (rowId: string, segmentId: string, shift?: boolean, mod?: boolean) => void;
  /**
   *
   */
  clearSelection: () => void;
  /**
   * Force-focus a particular animation instance by clearing the current selection (keypoints +
   * reference) and seeding the selection state with the provided instance id.
   */
  focusSelectionInstance: (instanceId: string) => void;
  /**
   * Set the currently emphasized (hovered) source row. Pass null to clear.
   */
  setEmphasis: (rowId: string | null) => void;
  /**
   * Toggle a track (or group's leaves) in/out of the targeted set.
   * Sets the target anchor for subsequent range operations.
   */
  toggleTrackTarget: (rowId: string) => void;
  /**
   * Replace the targeted track set with the given row IDs (resolved to leaves).
   */
  setTrackTargets: (rowIds: string[]) => void;
  /**
   * Clear all track targeting.
   */
  clearTrackTargets: () => void;
  /**
   * Target all rows between fromRowId and toRowId in display order (resolved to leaves).
   * Uses sourceRowIds.flat for ordering.
   */
  rangeTarget: (fromRowId: string, toRowId: string) => void;
  /**
   * Update the expanded and hidden state of a source group globally.
   * @param groupId - The ID of the source group to update.
   * @param expanded - Whether the group is expanded or collapsed.
   * @param hidden - Whether the group is hidden or visible.
   * Note: This affects all views since sources are now globally managed.
   */
  updateSource: (groupId: string, expanded?: boolean, hidden?: boolean) => void;
  /**
   * Update multiple source groups' expanded and hidden states globally at once.
   * @param groupStates - A record mapping group IDs to their expanded and hidden states.
   * Note: This affects all views since sources are now globally managed.
   */
  updateSources: (groupStates: Record<string, { expanded?: boolean; hidden?: boolean }>) => void;
  /**
   * Update per-view track visibility state.
   * `hidden` applies to leaf source track ids; group ids will be expanded to their descendant tracks.
   */
  updateViewTrackVisibility: (
    viewId: string,
    updates: Record<string, { hidden?: boolean }>,
  ) => void;
  /**
   * @deprecated Use `useValuesStore.getState().updateValues` instead.
   */
  updateValues: (values: Map<string, RawValue | undefined>) => void;
  /**
   * @deprecated Use `useValuesStore.getState().updateVelocities` instead.
   */
  updateVelocities: (velocities: Map<string, RawValue | undefined>) => void;
  /**
   * @deprecated Use `useValuesStore.getState().setTrackValue` instead.
   */
  setTrackValue: (trackKey: string, value: RawValue | ((current: RawValue) => RawValue)) => void;
  /**
   * Creates a new view
   */
  addView: (view: Partial<View> & { id: string }) => void;
  /**
   * Replaces all editor views and selection state in one operation.
   */
  replaceEditorViews: (state: EditorViewState) => void;
  /**
   * Sets the active editor view id.
   */
  setActiveEditorView: (viewId: string) => void;
  /**
   * Updates a view
   */
  updateView: (viewId: string, view: Partial<View>) => void;
  /**
   * Removes a view
   */
  removeView: (viewId: string) => void;
  /**
   * Insert a keypoint at the given world (player) stamp for a specific instance.
   * Computes the local stamp using instance transforms and derives value via the derived snapshot interpolator when available.
   */
  insertKeypointAtWorldStamp: (trackId: string, worldStamp: number, instanceId: string) => void;
  /**
   * Create a new animation, empty animation in the store.
   */
  createNewDefaultAnimation: () => void;
  /**
   * Update the animation data.
   * @param animation - The animation data to add.
   */
  addAnimation: (animation: StoredAnimation) => void;
  /**
   * Update transition defaults used for newly inserted keypoints.
   */
  updateNewKeyTransitionDefaults: (patch: TransitionPatch) => void;
  /**
   * Update transitions for the currently selected keypoints.
   */
  updateSelectedKeyTransitions: (patch: TransitionPatch) => void;
  /**
   * Set multiple animations at once, replacing existing animations.
   * @param animations - Record of animation ID to StoredAnimation
   */
  setAnimations: (animations: Record<string, StoredAnimation>) => void;
  /**
   * Remove an animation by its ID.
   * @param animationId - The ID of the animation to remove.
   */
  removeAnimation: (animationId: string, removeTracks?: boolean) => void;
  /**
   * Update a keypoint by track and keyframe/time in the animation.
   * @param trackId - The ID of the track.
   * @param keypoint - The keypoint data to update.
   * @param canMerge - Whether to allow merging of keypoints by stamp.
   */
  updateKeypoint: (trackId: string, keypoint: Partial<SimpleKeypoint>, canMerge?: boolean) => void;
  /**
   * Update multiple keypoints at once.
   * @param keypoints - An array of keypoints to update.
   * @param canMerge - Whether to allow merging of keypoints by stamp
   */
  updateKeypoints: (
    keypoints: { trackId: string; keypoint: Partial<SimpleKeypoint> }[],
    canMerge?: boolean,
  ) => void;
  /**
   * Add a new keypoint to a track.
   * @param trackId - The ID of the track.
   * @param keypoint - The keypoint data to create.
   */
  createKeypoint: (trackId: string, keypoint: Partial<SimpleKeypoint>) => void;
  /**
   * Create multiple keypoints at once.
   * @param keypoints - An array of keypoints to create.
   */
  createKeypoints: (keypoints: { trackId: string; keypoint: Partial<SimpleKeypoint> }[]) => void;
  /**
   * Update a track's data (other than id and points).
   * @param track - The track data to update.
   */
  updateTrack: (track: Partial<SimpleTrack>) => void;
  /**
   * Update the group label associated with one or more tracks (leaves remain unchanged).
   */
  updateTrackGroupName: (trackIds: string[], name: string) => void;
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
  createTrack: (track: Partial<SimpleTrack>, animatableId: string, animationId: string) => void;
  /**
   * Set multiple tracks at once, replacing existing tracks.
   * @param tracks - Record of track ID to Track
   */
  setTracks: (tracks: Record<string, SimpleTrack>) => void;
  /**
   * Remove a track from the animation.
   * @param trackId - The ID of the track to remove.
   * @param animationId - The ID of the animation to remove the track from.
   */
  removeTrack: (trackId: string, animationId: string) => void;
  /**
   * Skip to the next keyframe (optionally filter by track).
   * @param animationId - The ID of the animation.
   * @param namespaceIds - An array of namespace IDs to filter by.
   * @param trackIds - An array of track IDs to filter by.
   * @param respectBounds - Whether to respect bounds.
   */
  skipToNextKeyframe: (sourceRow: SourceRow, respectBounds?: boolean) => void;
  /**
   * Skip to the previous keyframe (optionally filter by track).
   * @param animationId - The ID of the animation.
   * @param namespaceIds - An array of namespace IDs to filter by.
   * @param trackIds - An array of track IDs to filter by.
   * @param respectBounds - Whether to respect bounds.
   */
  skipToPrevKeyframe: (sourceRow: SourceRow, respectBounds?: boolean) => void;
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
   * Add an animation to the visualized set.
   * @param animationId - The ID of the animation to visualize.
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
  /**
   * Update the color of a control.
   * @param controlId - The ID of the control.
   * @param color - The color to set.
   */
  updateControlColor: (controlId: string, color: string) => void;
  /**
   * Set the muted state of a source track. When unmuting, conflicting tracks within the
   * same namespace and animatable are muted.
   * @param sourceId - Source track id (`namespaceId/instanceId/trackId`) to update.
   * @param muted - Whether the track is muted.
   */
  setTracksMuted: (sourceIds: string | string[], muted: boolean) => void;
  /**
   * Set the visible state of source track(s). Affects canvas rendering.
   * @param sourceIds - Source track id(s) to update.
   * @param visible - Whether the track's keypoints/splines render in the canvas.
   */
  setTracksVisible: (sourceIds: string | string[], visible: boolean) => void;
  /**
   * Set the locked state of source track(s). Prevents editing.
   * @param sourceIds - Source track id(s) to update.
   * @param locked - Whether the track is locked from editing.
   */
  setTracksLocked: (sourceIds: string | string[], locked: boolean) => void;
  /**
   * Set animatables in bulk, replacing existing animatables.
   * @param animatables - Record of animatable ID to AnimatableValue
   */
  setAnimatables: (animatables: Record<string, AnimatableValue>) => void;
  /**
   * Add or replace a single animatable.
   * @param animatable - Animatable to add/update
   */
  addAnimatable: (animatable: AnimatableValue) => void;
  /**
   * Update a single animatable by id.
   * @param id - Animatable id to update
   * @param animatable - Partial animatable payload
   */
  updateAnimatable: (id: string, animatable: Partial<AnimatableValue>) => void;
  /**
   * Remove a single animatable by id.
   * @param id - Animatable id to remove
   */
  removeAnimatable: (id: string) => void;
  /**
   * Set the namespaces for the animation data.
   * @param namespaces - Record of namespace ID to Namespace
   */
  setNamespaces: (namespaces: Record<string, Namespace>) => void;
  /**
   * Add or replace a single namespace entry.
   * @param namespace - Namespace to add/update
   */
  addNamespace: (namespace: Namespace) => void;
  /**
   * Set the preferences for the animation data.
   * @param preferences - The preferences to set.
   */
  setPreferences: (preferences: AnimationPreferencesPatch) => void;
  /**
   * Update the duration of an animation.
   * @param animationId - The ID of the animation.
   * @param duration - The duration to set.
   * @param rescale - Whether to rescale the animation.
   */
  updateAnimationDuration: (animationId: string, duration: number, rescale: boolean) => void;

  /**
   * Start a drag operation anchored to the provided marker.
   */
  startDrag: (input: DragStartInput) => void;

  /**
   * Start a value-driven drag (slider-driven vertical drag).
   */
  startValueDrag: (input: ValueDragStartInput) => void;

  /**
   * Start a drag operation for a handle (in/out).
   */
  startHandleDrag: (input: HandleDragStartInput) => void;

  /**
   * Update the active drag with pointer deltas.
   */
  updateDrag: (input: DragUpdateInput) => void;

  /**
   * Update the active value-driven drag with a new value.
   */
  updateValueDrag: (input: ValueDragUpdateInput) => void;

  /**
   * Update the active handle drag with pointer deltas.
   */
  updateHandleDrag: (input: HandleDragUpdateInput) => void;

  /**
   * Commit the current drag operation, applying all changes.
   */
  commitDrag: () => void;

  /**
   * Commit the current value-driven drag, applying all changes.
   */
  commitValueDrag: () => void;

  /**
   * Cancel the current drag operation without applying changes.
   */
  cancelDrag: () => void;

  /**
   * Cancel the current value-driven drag without applying changes.
   */
  cancelValueDrag: () => void;
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
  replace?: false,
) => void;

/**
 * Type representing the getter function for the animation store.
 */
export type AnimationStoreGetter = () => AnimationData & AnimationActions;

export type AnimationApi = Write<
  StoreApi<AnimationData & AnimationActions>,
  StoreSubscribeWithSelector<AnimationData & AnimationActions>
>;
