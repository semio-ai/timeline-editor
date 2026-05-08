import { RawValue, AnimatableValue, useValuesStore } from "@semio/utils";
import { TimeDisplay } from "@semio/ui";
import { subscribeWithSelector } from "zustand/middleware";
import { produce, enableMapSet } from "immer";
import { create } from "zustand";
import {
  Track,
  StoredAnimation,
  Preview,
  SourceRow,
  Namespace,
  DragUpdateInput,
  DragStartInput,
  ValueDragStartInput,
  ValueDragUpdateInput,
  HandleDragStartInput,
  HandleDragUpdateInput,
  MarkerPoint,
} from "./types";
import type { SimpleTrack, SimpleKeypoint } from "./types/data/simple-track";
import {
  AnimationData,
  AnimationActions,
  AnimationPreferencesPatch,
  AnimationStoreGetter,
  AnimationStoreSetter,
  AnimationApi,
  TransitionPatch,
  EditorViewState,
  EntityAnimationState,
  BoxSelectState,
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
  updateControlColor,
  insertKeypointAtWorldStamp as insertKeyAtWorldStampAction,
  updateNewKeyTransitionDefaults as updateNewKeyTransitionDefaultsAction,
  updateSelectedKeyTransitions as updateSelectedKeyTransitionsAction,
  copySelection as copySelectionAction,
  cutSelection as cutSelectionAction,
  pasteAtStamp as pasteAtStampAction,
  deleteSelection as deleteSelectionAction,
  startBoxSelect as startBoxSelectAction,
  updateBoxSelect as updateBoxSelectAction,
  cancelBoxSelect as cancelBoxSelectAction,
  commitBoxSelect as commitBoxSelectAction,
  setBoxSelectPending as setBoxSelectPendingAction,
  updateViewTrackVisibility as updateViewTrackVisibilityAction,
  setTracksMuted as setTracksMutedAction,
  setTracksVisible as setTracksVisibleAction,
  setTracksLocked as setTracksLockedAction,
  setSourcesReadonly as setSourcesReadonlyAction,
  setAnimationReadonly as setAnimationReadonlyAction,
  setPreferences as setPreferencesAction,
  addView as addViewAction,
  replaceEditorViews as replaceEditorViewsAction,
  setActiveEditorView as setActiveEditorViewAction,
  updateView as updateViewAction,
  removeView as removeViewAction,
  setVerticalViewport as setVerticalViewportAction,
  selectAll as selectAllAction,
  selectAllInTracks as selectAllInTracksAction,
  focusSelectionInstance as focusSelectionInstanceAction,
  setActiveEntity as setActiveEntityAction,
  setEntityControlMode as setEntityControlModeAction,
  setEntityStates as setEntityStatesAction,
  setEmphasis as setEmphasisAction,
  selectTrack as selectTrackAction,
  toggleTrackInSelection as toggleTrackInSelectionAction,
  rangeSelectTracks as rangeSelectTracksAction,
  skipToNextKeyframe as skipToNextKeyframeAction,
  skipToPrevKeyframe as skipToPrevKeyframeAction,
  skipToStart as skipToStartAction,
  skipToEnd as skipToEndAction,
  updateDuration as updateDurationAction,
  updateAnimationDuration as updateAnimationDurationAction,
  updateFramerate as updateFramerateAction,
  addPreview as addPreviewAction,
  removePreview as removePreviewAction,
  updatePreview as updatePreviewAction,
  updateHoverpointPreview as updateHoverpointPreviewAction,
} from "./actions";
import { clickMarkerAction, clearSelectionAction } from "./actions/click-marker";
import {
  startDrag,
  startValueDrag,
  updateDrag,
  updateValueDrag,
  commitDrag,
  commitValueDrag,
  cancelDrag,
  cancelValueDrag,
  startHandleDrag,
  updateHandleDrag,
} from "./actions/drag";
import {
  computeStoredAnimation,
  computeUpdatedSources,
  getNonEditableTrackIds,
} from "./functions";
import {
  updatePlayerLoop,
  updateOverallDuration,
  updateInstancedTrackSources,
  updateViewFilteredSourceRows,
  updateGlobalSources,
  updateSourceRowIds,
  initDerivedOrchestrator,
  updateActiveEntityContext,
  viewportFollow,
} from "./subscriptions";
import { View } from "./types/util/view";
import { clickLineAction } from "./actions/click-line";
import { parseTrackKey } from "./utils/track-key";

enableMapSet();

const applyTrackValue = (
  state: AnimationData,
  trackKey: string,
  value: RawValue | ((current: RawValue) => RawValue),
) => {
  const lookupId = trackKey;
  const valuesState = useValuesStore.getState();
  if (typeof value === "function") {
    const current: RawValue | undefined = valuesState.values.get(lookupId);
    if (current === undefined) {
      // Get the default value from the animatable if it exists.
      const { trackId } = parseTrackKey(lookupId);
      const animatableId = state.tracks[trackId]?.animatableId;
      const animatable = animatableId ? state.animatables[animatableId] : undefined;
      const fallback = animatable?.default;
      if (fallback === undefined) {
        return;
      }
      useValuesStore.getState().setTrackValue(lookupId, value(fallback));
    } else {
      useValuesStore.getState().setTrackValue(lookupId, value(current));
    }
  } else {
    useValuesStore.getState().setTrackValue(lookupId, value);
  }
};

export const AnimationSlice = (
  set: AnimationStoreSetter,
  get: AnimationStoreGetter,
  api: AnimationApi,
) => {
  return {
    ...createDefaultState(),
    updateSource: (groupId: string, expanded?: boolean) => {
      set(
        produce((state: AnimationData) => {
          const updates = { [groupId]: { expanded } };
          state.globalSourceTree = computeUpdatedSources(state.globalSourceTree, updates);
        }),
      );
    },
    updateSources: (updates: Record<string, { expanded?: boolean }>) => {
      set(
        produce((state: AnimationData) => {
          const expansionUpdates: Record<string, { expanded?: boolean }> = {};
          Object.entries(updates).forEach(([id, update]) => {
            if (update.expanded !== undefined) {
              expansionUpdates[id] = { expanded: update.expanded };
            }
          });
          if (Object.keys(expansionUpdates).length === 0) {
            return;
          }
          state.globalSourceTree = computeUpdatedSources(state.globalSourceTree, expansionUpdates);
        }),
      );
    },
    updateViewTrackVisibility: (viewId: string, updates: Record<string, { hidden?: boolean }>) =>
      updateViewTrackVisibilityAction(set, viewId, updates),
    updateValues: (values: Map<string, RawValue | undefined>) => {
      useValuesStore.getState().updateValues(values);
    },
    updateVelocities: (velocities: Map<string, RawValue | undefined>) => {
      useValuesStore.getState().updateVelocities(velocities);
    },
    setTrackValue: (trackKey: string, value: RawValue | ((current: RawValue) => RawValue)) => {
      // applyTrackValue needs AnimationData for animatable defaults, so we still
      // need to read from the main store, but it writes to useValuesStore internally.
      const state = get();
      applyTrackValue(state, trackKey, value);
    },
    createNewDefaultAnimation: () => {
      set(
        produce((state: AnimationData) => {
          const defaultAnimation = createDefaultAnimation();
          addAnimation(state, defaultAnimation);
        }),
      );
    },
    setAnimatables: (animatables: Record<string, AnimatableValue>) => {
      set(
        produce((state: AnimationData): void => {
          state.animatables = animatables;
        }),
      );
    },
    addAnimatable: (animatable: AnimatableValue) => {
      set(
        produce((state: AnimationData): void => {
          state.animatables = { ...state.animatables, [animatable.id]: animatable };
        }),
      );
    },
    updateAnimatable: (id: string, animatable: Partial<AnimatableValue>) => {
      set(
        produce((state: AnimationData): void => {
          const existing = state.animatables[id];
          if (!existing) return;
          const nextAnimatable = { ...existing, ...animatable, id } as AnimatableValue;
          state.animatables = {
            ...state.animatables,
            [id]: nextAnimatable,
          };
        }),
      );
    },
    removeAnimatable: (id: string) => {
      // TODO: also clear matching dotKey entries (and trackKeys for tracks
      // referencing this animatable) from useValuesStore. Orphaned entries are
      // currently inert (readers query by current animatable IDs) but
      // accumulate until project reload. See useValuesStore JSDoc lifecycle
      // section.
      set(
        produce((state: AnimationData): void => {
          if (!(id in state.animatables)) return;
          const { [id]: _, ...rest } = state.animatables;
          state.animatables = rest;
        }),
      );
    },
    setNamespaces: (namespaces: Record<string, Namespace>) => {
      set(
        produce((state: AnimationData): void => {
          state.namespaces = namespaces;
        }),
      );
    },
    addNamespace: (namespace: Namespace) => {
      set(
        produce((state: AnimationData): void => {
          state.namespaces[namespace.id] = namespace;
        }),
      );
    },
    updateKeypoint: (trackId: string, keypoint: Partial<SimpleKeypoint>, canMerge?: boolean) => {
      const { nonEditableIds } = getNonEditableTrackIds(get().instancedTrackSources);
      if (nonEditableIds.has(trackId)) return;
      set(
        produce((state: AnimationData): void => {
          updateKeypoint(state, trackId, keypoint, canMerge);
        }),
      );
    },
    updateKeypoints: (
      keypoints: { trackId: string; keypoint: Partial<SimpleKeypoint> }[],
      canMerge?: boolean,
    ) => {
      const { nonEditableIds } = getNonEditableTrackIds(get().instancedTrackSources);
      const writable = keypoints.filter(({ trackId }) => !nonEditableIds.has(trackId));
      if (writable.length === 0) return;
      set(
        produce((state: AnimationData): void => {
          writable.forEach(({ trackId, keypoint }) => {
            updateKeypoint(state, trackId, keypoint, canMerge);
          });
        }),
      );
    },
    addView: (view: Partial<View> & { id: string }) => addViewAction(set, view),
    replaceEditorViews: (next: EditorViewState) => replaceEditorViewsAction(set, next),
    setActiveEditorView: (viewId: string) => setActiveEditorViewAction(set, viewId),
    updateView: (viewId: string, view: Partial<View>) => updateViewAction(set, viewId, view),
    removeView: (viewId: string) => removeViewAction(set, viewId),
    setVerticalViewport: (
      viewId: string,
      viewport: { top: number; bottom: number } | undefined,
    ) => setVerticalViewportAction(set, viewId, viewport),
    addAnimation: (animation: StoredAnimation) => {
      set(
        produce((state: AnimationData): void => {
          addAnimation(state, animation);
        }),
      );
    },
    setAnimations: (animations: Record<string, StoredAnimation>) => {
      set(
        produce((state: AnimationData): void => {
          // Clear existing animations
          state.animations = {};
          // Add all animations
          Object.values(animations).forEach((animation) => {
            addAnimation(state, animation);
          });
        }),
      );
    },
    updateNewKeyTransitionDefaults: (patch: TransitionPatch) => {
      set(
        produce((state: AnimationData): void => {
          updateNewKeyTransitionDefaultsAction(state, patch);
        }),
      );
    },
    updateSelectedKeyTransitions: (patch: TransitionPatch) => {
      // Coarse short-circuit: when every selected track is non-editable
      // there's nothing to do, so skip the produce entirely. The action
      // itself filters per-context on `nonEditableIds` so mixed
      // selections (some readonly, some writable — possible when
      // permissions change mid-session) only mutate the writable ones.
      const { nonEditableIds } = getNonEditableTrackIds(get().instancedTrackSources);
      const selected = get().selectionState.keypoints;
      const anyEditable = Array.from(selected.keys()).some((id) => !nonEditableIds.has(id));
      if (!anyEditable) return;
      set(
        produce((state: AnimationData): void => {
          updateSelectedKeyTransitionsAction(state, patch);
        }),
      );
    },
    removeAnimation: (animationId: string, removeTracks = true) => {
      set(
        produce((state: AnimationData): void => {
          removeAnimation(state, animationId, removeTracks);
        }),
      );
    },
    createKeypoint: (trackId: string, point: Partial<SimpleKeypoint>) => {
      const { nonEditableIds } = getNonEditableTrackIds(get().instancedTrackSources);
      if (nonEditableIds.has(trackId)) return;
      set(
        produce((state: AnimationData): void => {
          createKeypoint(state, trackId, point);
        }),
      );
    },
    createKeypoints: (keypoints: { trackId: string; keypoint: Partial<SimpleKeypoint> }[]) => {
      const { nonEditableIds } = getNonEditableTrackIds(get().instancedTrackSources);
      const writable = keypoints.filter(({ trackId }) => !nonEditableIds.has(trackId));
      if (writable.length === 0) return;
      set(
        produce((state: AnimationData): void => {
          writable.forEach(({ trackId, keypoint }) => {
            createKeypoint(state, trackId, keypoint);
          });
        }),
      );
    },
    updateTrack: (track: Partial<SimpleTrack>) => {
      if (track.id) {
        const { nonEditableIds } = getNonEditableTrackIds(get().instancedTrackSources);
        if (nonEditableIds.has(track.id)) return;
      }
      set(
        produce((state: AnimationData) => {
          updateTrack(state, track);
          if (track.id) {
            state.tracksRevision = (state.tracksRevision ?? 0) + 1;
          }
        }),
      );
    },
    updateTrackGroupName: (trackIds: string[], name: string) => {
      const { nonEditableIds } = getNonEditableTrackIds(get().instancedTrackSources);
      const writable = trackIds.filter((id) => !nonEditableIds.has(id));
      if (writable.length === 0) return;
      set(
        produce((state: AnimationData) => {
          const nextTracks = { ...state.tracks };
          writable.forEach((id) => {
            const existing = nextTracks[id];
            if (existing) {
              nextTracks[id] = { ...existing, groupName: name };
            }
          });
          state.tracks = nextTracks;
          state.tracksRevision = (state.tracksRevision ?? 0) + 1;
        }),
      );
    },
    removeKeypoint: (trackId: string, keypointId: string) => {
      const { nonEditableIds } = getNonEditableTrackIds(get().instancedTrackSources);
      if (nonEditableIds.has(trackId)) return;
      set(
        produce((state: AnimationData): void => {
          removeKeypoint(state, trackId, keypointId);
        }),
      );
    },
    removeKeypoints: (keypoints: { trackId: string; keypointId: string }[]) => {
      const { nonEditableIds } = getNonEditableTrackIds(get().instancedTrackSources);
      const writable = keypoints.filter((k) => !nonEditableIds.has(k.trackId));
      if (writable.length === 0) return;
      set(
        produce((state: AnimationData): void => {
          writable.forEach(({ trackId, keypointId }) => {
            removeKeypoint(state, trackId, keypointId);
          });
        }),
      );
    },
    createTrack: (track: Partial<SimpleTrack>, animatableId: string, animationId: string) => {
      // Document-permission gate at the action level so any caller (UI,
      // future programmatic paths) can't silently mutate a readonly
      // animation. The new track doesn't exist yet, so the per-track
      // `nonEditableIds` check used by keypoint actions can't apply
      // here — consult the animation-level map maintained by
      // `setAnimationReadonly`.
      if (get().readonlyAnimations[animationId]) {
        // Surfaces caller bugs: hitting this branch means a UI gate
        // failed to disable the action. Telemetry will replace this with
        // a structured event when the PostHog wiring lands.
        console.warn(
          `[animation] createTrack blocked: animation ${animationId} is readonly (animatable=${animatableId})`,
        );
        return;
      }
      set(
        produce((state: AnimationData): void => {
          createTrack(state, animatableId, animationId, track);
          state.tracksRevision = (state.tracksRevision ?? 0) + 1;
        }),
      );
    },
    setTracks: (tracks: Record<string, Track<RawValue>>) => {
      set(
        produce((state: AnimationData): void => {
          state.tracks = tracks as Record<string, SimpleTrack>;
          state.tracksRevision = (state.tracksRevision ?? 0) + 1;
        }),
      );
    },
    removeTrack: (trackId: string, animationId: string) => {
      // Gate on both the per-track readonly flag (the track itself was
      // marked non-editable) AND the animation-level map (the parent
      // animation is fully readonly — covers the empty-animation race
      // where the per-track flag hasn't propagated yet).
      if (get().readonlyAnimations[animationId]) {
        console.warn(
          `[animation] removeTrack blocked: animation ${animationId} is readonly (track=${trackId})`,
        );
        return;
      }
      const { nonEditableIds } = getNonEditableTrackIds(get().instancedTrackSources);
      if (nonEditableIds.has(trackId)) {
        console.warn(
          `[animation] removeTrack blocked: track ${trackId} is non-editable (locked or readonly)`,
        );
        return;
      }
      set(
        produce((state: AnimationData) => {
          removeTrack(state, animationId, trackId);
          state.tracksRevision = (state.tracksRevision ?? 0) + 1;
        }),
      );
    },
    skipToNextKeyframe: (sourceRow: SourceRow, respectBounds?: boolean) =>
      skipToNextKeyframeAction(get, sourceRow, respectBounds),
    skipToPrevKeyframe: (sourceRow: SourceRow, respectBounds?: boolean) =>
      skipToPrevKeyframeAction(get, sourceRow, respectBounds),
    skipToStart: () => skipToStartAction(),
    skipToEnd: () => skipToEndAction(),
    updateDuration: (duration: number) => updateDurationAction(set, duration),
    updateAnimationDuration: (animationId: string, duration: number, rescale: boolean) =>
      updateAnimationDurationAction(set, animationId, duration, rescale),
    updateFramerate: (framerate: number) => updateFramerateAction(set, framerate),
    setExpanded: (expanded: boolean) => {
      set({ expanded });
    },
    setTimeDisplay: (timeDisplay: TimeDisplay) => {
      set({ timeDisplay });
    },
    getStorableAnimation: (animationId: string) => {
      const state = get();
      const stored = computeStoredAnimation(state.animations[animationId], state.tracks);
      return stored;
    },
    getAnimationsToSave: (): StoredAnimation[] => {
      const state = get();
      return Object.keys(state.animations).map((animationId) =>
        state.getStorableAnimation(animationId),
      );
    },
    insertKeypointAtWorldStamp: (trackId: string, worldStamp: number, instanceId: string) => {
      const { nonEditableIds } = getNonEditableTrackIds(get().instancedTrackSources);
      if (nonEditableIds.has(trackId)) return;
      set(
        produce((state: AnimationData) => {
          insertKeyAtWorldStampAction(state, trackId, worldStamp, instanceId);
        }),
      );
    },
    initAnimationSubscriptions: () => {
      // Clean up any previous subscriptions for this store instance
      const existingCleanup = (api as any).__derivedCleanup as (() => void) | undefined;
      if (typeof existingCleanup === "function") {
        existingCleanup();
        (api as any).__derivedCleanup = undefined;
      }

      // Delay subscription initialization to prevent cascading updates during store creation
      const unsubs = [
        updatePlayerLoop,
        viewportFollow,
        updateOverallDuration,
        initDerivedOrchestrator,
        updateInstancedTrackSources,
        updateGlobalSources,
        updateSourceRowIds,
        updateViewFilteredSourceRows,
        updateActiveEntityContext,
      ].map((fn) => fn(api, set, get));

      const cleanup = () => {
        unsubs.forEach((unsub) => unsub());
      };
      (api as any).__derivedCleanup = cleanup;
      return cleanup;
    },
    /**
     * Handle marker click with various modifier key behaviors for selection.
     *
     * Selection behaviors:
     * 1. A plain click replaces the current selection and sets the clicked marker as the reference.
     * 2. Ctrl/Cmd-click toggles a marker in the selection (cross-row allowed) and, when adding, updates the reference to that marker.
     * 3. Shift-click within the reference row selects the range between the anchor and clicked markers without updating the reference.
     * 4. Shift-click in any other row behaves like a plain click (replaces selection and moves the reference).
     * 5. If Ctrl/Cmd-click removes the reference marker, the reference is cleared until another marker is explicitly clicked.
     *
     * @param clickedPoints - Selection points for the marker (pre-filtered for selectable).
     * @param rowId - The source row containing the marker.
     * @param markerId - The marker identifier within the row.
     * @param shift - Whether shift key is held.
     * @param mod - Whether mod key (Cmd on Mac, Ctrl on PC) is held.
     */
    clickMarker: (
      clickedPoints: MarkerPoint[],
      rowId: string,
      markerId: string,
      shift?: boolean,
      mod?: boolean,
    ) => {
      set((state: AnimationData) => {
        const result = clickMarkerAction(state, clickedPoints, rowId, markerId, shift, mod);
        return {
          ...state,
          ...result,
        };
      });
    },
    clickLine: (rowId: string, segmentId: string, shift?: boolean, mod?: boolean) => {
      set((state: AnimationData) => {
        const result = clickLineAction(state, rowId, segmentId, shift, mod);
        return {
          ...state,
          ...result,
        };
      });
    },
    clearSelection: () => {
      set((state: AnimationData) => clearSelectionAction(state));
    },
    copySelection: () => copySelectionAction(set, get),
    cutSelection: () => cutSelectionAction(set, get),
    pasteAtStamp: (worldStamp: number) => pasteAtStampAction(set, get, worldStamp),
    deleteSelection: () => deleteSelectionAction(set, get),
    selectAll: () => selectAllAction(set),
    selectAllInTracks: (trackKeys: string[]) => selectAllInTracksAction(set, trackKeys),
    focusSelectionInstance: (instanceId: string) =>
      focusSelectionInstanceAction(set, instanceId),
    setActiveEntity: (entityId: string | null) => setActiveEntityAction(set, get, entityId),
    setEntityControlMode: (entityId: string, mode: "direct" | "animation", instanceId?: string) =>
      setEntityControlModeAction(set, get, entityId, mode, instanceId),
    setEntityStates: (states: Record<string, EntityAnimationState>) =>
      setEntityStatesAction(set, states),
    setEmphasis: (rowId: string | null) => setEmphasisAction(set, rowId),
    selectTrack: (rowId: string, trackIds: string[]) =>
      selectTrackAction(set, rowId, trackIds),
    toggleTrackInSelection: (rowId: string, trackIds: string[]) =>
      toggleTrackInSelectionAction(set, rowId, trackIds),
    rangeSelectTracks: (fromRowId: string, toRowId: string) =>
      rangeSelectTracksAction(set, fromRowId, toRowId),
    startBoxSelect: (boxState: BoxSelectState) => startBoxSelectAction(set, get, boxState),
    updateBoxSelect: (currentStamp: number, currentY: number) =>
      updateBoxSelectAction(set, get, currentStamp, currentY),
    cancelBoxSelect: () => cancelBoxSelectAction(set, get),
    commitBoxSelect: () => commitBoxSelectAction(set),
    setBoxSelectPending: (pending: boolean) => setBoxSelectPendingAction(set, pending),
    addPreview: (preview: Preview) => addPreviewAction(set, preview),
    removePreview: (evaluator: (preview: Preview) => boolean) =>
      removePreviewAction(set, evaluator),
    updatePreview: (evaluator: (preview: Preview) => boolean, preview: Partial<Preview>) =>
      updatePreviewAction(set, evaluator, preview),
    updateHoverpointPreview: (value: number | null) => updateHoverpointPreviewAction(set, value),
    updateControlColor: (controlId: string, color: string) => {
      set(
        produce((state: AnimationData): void => {
          updateControlColor(state, controlId, color);
        }),
      );
    },
    setTracksMuted: (sourceIds: string | string[], muted: boolean) =>
      setTracksMutedAction(set, sourceIds, muted),
    setTracksVisible: (sourceIds: string | string[], visible: boolean) =>
      setTracksVisibleAction(set, sourceIds, visible),
    setTracksLocked: (sourceIds: string | string[], locked: boolean) =>
      setTracksLockedAction(set, get, sourceIds, locked),
    setSourcesReadonly: (sourceIds: string | string[], readonly: boolean) =>
      setSourcesReadonlyAction(set, get, sourceIds, readonly),
    setAnimationReadonly: (animationId: string, readonly: boolean) =>
      setAnimationReadonlyAction(set, get, animationId, readonly),
    setPreferences: (preferences: AnimationPreferencesPatch) =>
      setPreferencesAction(set, preferences),

    // Drag actions - ID-based with instance validation
    startDrag: (input: DragStartInput) => {
      set(
        produce((state: AnimationData): void => {
          // Cancel any in-progress box-select — keypoint drag takes priority.
          // Restore the selection snapshot from before the box-select started.
          if (state.boxSelectState) {
            state.selectionState.keypoints = state.boxSelectState.initialKeypoints;
            state.boxSelectState = null;
          }
          startDrag(state, input);
        }),
      );
    },
    startValueDrag: (input: ValueDragStartInput) => {
      set(
        produce((state: AnimationData): void => {
          if (state.boxSelectState) {
            state.selectionState.keypoints = state.boxSelectState.initialKeypoints;
            state.boxSelectState = null;
          }
          startValueDrag(state, input);
        }),
      );
    },
    startHandleDrag: (input: HandleDragStartInput) => {
      set(
        produce((state: AnimationData): void => {
          if (state.boxSelectState) {
            state.selectionState.keypoints = state.boxSelectState.initialKeypoints;
            state.boxSelectState = null;
          }
          startHandleDrag(state, input);
        }),
      );
    },
    updateDrag: (input: DragUpdateInput) => {
      set(
        produce((state: AnimationData): void => {
          updateDrag(state, input);
        }),
      );
    },
    updateValueDrag: (input: ValueDragUpdateInput) => {
      set(
        produce((state: AnimationData): void => {
          updateValueDrag(state, input);
        }),
      );
    },
    updateHandleDrag: (input: HandleDragUpdateInput) => {
      set(
        produce((state: AnimationData): void => {
          updateHandleDrag(state, input);
        }),
      );
    },
    commitDrag: () => {
      set(
        produce((state: AnimationData): void => {
          commitDrag(state);
        }),
      );
    },
    commitValueDrag: () => {
      set(
        produce((state: AnimationData): void => {
          commitValueDrag(state);
        }),
      );
    },
    cancelDrag: () => {
      set(
        produce((state: AnimationData): void => {
          cancelDrag(state);
        }),
      );
    },
    cancelValueDrag: () => {
      set(
        produce((state: AnimationData): void => {
          cancelValueDrag(state);
        }),
      );
    },
  };
};

export const useDefaultAnimationStore = create<AnimationData & AnimationActions>()(
  subscribeWithSelector((set, get, api) => ({
    ...AnimationSlice(set, get, api),
  })),
);

// Subscriptions on `useDefaultAnimationStore` are now opt-in. Module-load
// auto-init was causing two `update-player-loop` subscriptions on the
// shared `usePlayerStore` (one for this default store, one for the
// studio's composite store), which compounded into a React 19 max-depth
// cascade on every player tick. Standalone consumers that fall back to
// `useDefaultAnimationStore` (currently only `AnimationSheet`) call
// `initAnimationSubscriptions()` themselves on mount.

export function createAnimationStore(initial?: Partial<AnimationData>): AnimationStore {
  const store = create<AnimationData & AnimationActions>()(
    subscribeWithSelector((set, get, api) => {
      const slice = AnimationSlice(set, get, api);
      const mergedNewKeyDefaults = initial?.preferences?.newKeyDefaults
        ? {
            ...slice.preferences.newKeyDefaults,
            ...initial.preferences.newKeyDefaults,
            transitions: {
              ...slice.preferences.newKeyDefaults.transitions,
              ...initial.preferences.newKeyDefaults.transitions,
            },
          }
        : slice.preferences.newKeyDefaults;

      return {
        ...slice,
        ...initial,
        preferences: {
          ...slice.preferences,
          ...(initial?.preferences ?? {}),
          newKeyDefaults: mergedNewKeyDefaults,
        },
      };
    }),
  );
  store.getState().initAnimationSubscriptions();
  return store;
}

export type AnimationStore = typeof useDefaultAnimationStore;
