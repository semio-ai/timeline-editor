import { RawValue, usePlayerStore, AnimatableValue } from "@semio/utils";
import { TimeDisplay } from "@semio/ui";
import { subscribeWithSelector } from "zustand/middleware";
import { produce, enableMapSet } from "immer";
import { mapValues } from "lodash";
import { create } from "zustand";
import {
  Track,
  StoredAnimation,
  SemanticTime,
  Preview,
  SourceRow,
  TrackRender,
  Namespace,
  DragUpdateInput,
  DragStartInput,
  ValueDragStartInput,
  ValueDragUpdateInput,
  VerticalAxis,
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
  computeNextTime,
  computePreviousTime,
  computeUpdatedSources,
  computeLocalStamp,
  computeWorldStamp,
  collectSourceTracks,
  findSourceTrackById,
} from "./functions";
import {
  updatePlayerLoop,
  updateOverallDuration,
  updateInstancedTrackSources,
  updateConsolidatedSourceRow,
  updateViewFilteredGlobalRows,
  updateGlobalSources,
  updateSourceRowIds,
  updateTrackMuting,
  initDerivedOrchestrator,
} from "./subscriptions";
import { View } from "./types/util/view";
import { createEmptySelectionState } from "./functions/selection-state-manager";
import { clickLineAction } from "./actions/click-line";
import { parseTrackKey } from "./utils/track-key";

enableMapSet();

const applyTrackValue = (
  state: AnimationData,
  trackKey: string,
  value: RawValue | ((current: RawValue) => RawValue),
) => {
  const lookupId = trackKey;
  if (typeof value === "function") {
    const current: RawValue | undefined = state.values.get(lookupId);
    if (current === undefined) {
      // Get the default value from the animatable if it exists.
      const { trackId } = parseTrackKey(lookupId);
      const animatableId = state.tracks[trackId]?.animatableId;
      const animatable = animatableId ? state.animatables[animatableId] : undefined;
      const fallback = animatable?.default;
      if (fallback === undefined) {
        return;
      }
      state.values.set(lookupId, value(fallback));
    } else {
      state.values.set(lookupId, value(current));
    }
  } else {
    state.values.set(lookupId, value);
  }
};

export const AnimationSlice = (
  set: AnimationStoreSetter,
  get: AnimationStoreGetter,
  api: AnimationApi,
) => {
  return {
    ...createDefaultState(),
    updateSource: (groupId: string, expanded?: boolean, hidden?: boolean) => {
      set(
        produce((state: AnimationData) => {
          // Updates global sources, affecting all views
          const updates = { [groupId]: { expanded, hidden } };
          state.sourcesByAnimationInstance = mapValues(
            state.sourcesByAnimationInstance,
            (instanceSources) => computeUpdatedSources(instanceSources, updates),
          );
        }),
      );
    },
    updateSources: (updates: Record<string, { expanded?: boolean; hidden?: boolean }>) => {
      set(
        produce((state: AnimationData) => {
          // Updates global sources, affecting all views
          state.sourcesByAnimationInstance = mapValues(
            state.sourcesByAnimationInstance,
            (instanceSources) => computeUpdatedSources(instanceSources, updates),
          );
        }),
      );
    },
    updateValues: (values: Map<string, RawValue | undefined>) => {
      set(
        produce((state: AnimationData) => {
          values.forEach?.((value, key) => {
            if (value === undefined) {
              state.values.delete(key);
            } else {
              state.values.set(key, value);
            }
          });
        }),
      );
    },
    updateVelocities: (velocities: Map<string, RawValue | undefined>) => {
      set(
        produce((state: AnimationData) => {
          velocities.forEach?.((value, key) => {
            if (value === undefined) {
              state.velocities.delete(key);
            } else {
              state.velocities.set(key, value);
            }
          });
        }),
      );
    },
    setTrackValue: (trackKey: string, value: RawValue | ((current: RawValue) => RawValue)) => {
      set(
        produce((state: AnimationData) => {
          applyTrackValue(state, trackKey, value);
        }),
      );
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
      set(
        produce((state: AnimationData): void => {
          keypoints.forEach(({ trackId, keypoint }) => {
            updateKeypoint(state, trackId, keypoint, canMerge);
          });
        }),
      );
    },
    addView: (view: Partial<View> & { id: string }) => {
      set((state: AnimationData) => {
        const defaultView: View = {
          id: view.id,
          trackRender: view.trackRender ?? TrackRender.Key,
          verticalAxis: view.verticalAxis ?? VerticalAxis.Normalized,
          trackFilter: view.trackFilter ?? "",
        };
        return {
          editorViews: { ...state.editorViews, [view.id]: { ...defaultView, ...view } },
        };
      });
    },
    updateView: (viewId: string, view: Partial<View>) => {
      set(
        produce((state: AnimationData) => {
          if (!state.editorViews[viewId]) return;
          state.editorViews[viewId] = { ...state.editorViews[viewId], ...view };
        }),
      );
    },
    removeView: (viewId: string) => {
      set(
        produce((state: AnimationData) => {
          if (!state.editorViews[viewId]) return;
          const { [viewId]: _, ...rest } = state.editorViews;
          state.editorViews = rest;
        }),
      );
    },
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
      set(
        produce((state: AnimationData): void => {
          createKeypoint(state, trackId, point);
        }),
      );
    },
    createKeypoints: (keypoints: { trackId: string; keypoint: Partial<SimpleKeypoint> }[]) => {
      set(
        produce((state: AnimationData): void => {
          keypoints.forEach(({ trackId, keypoint }) => {
            createKeypoint(state, trackId, keypoint);
          });
        }),
      );
    },
    updateTrack: (track: Partial<SimpleTrack>) => {
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
      set(
        produce((state: AnimationData) => {
          const nextTracks = { ...state.tracks };
          trackIds.forEach((id) => {
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
      set(
        produce((state: AnimationData): void => {
          removeKeypoint(state, trackId, keypointId);
        }),
      );
    },
    removeKeypoints: (keypoints: { trackId: string; keypointId: string }[]) => {
      set(
        produce((state: AnimationData): void => {
          keypoints.forEach(({ trackId, keypointId }) => {
            removeKeypoint(state, trackId, keypointId);
          });
        }),
      );
    },
    createTrack: (track: Partial<SimpleTrack>, animatableId: string, animationId: string) => {
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
      set(
        produce((state: AnimationData) => {
          removeTrack(state, animationId, trackId);
          state.tracksRevision = (state.tracksRevision ?? 0) + 1;
        }),
      );
    },
    // Skip to the next keyframe
    skipToNextKeyframe: (sourceRow: SourceRow, respectBounds?: boolean) => {
      const state = get();
      const playerState = usePlayerStore.getState();
      const sourceRowId = sourceRow.id;
      const computedData = state.derivedSnapshot?.rows?.[sourceRowId]?.computed;
      if (!computedData) return;

      const instancedFrameData = computedData.virtualFrames;
      const { localStamp, localBounds, toWorld } = resolveRowTimeContext(
        state.namespaces,
        sourceRow,
        playerState.player.stamp,
        playerState.player.bounds,
      );
      const nextLocalTime = computeNextTime(
        instancedFrameData,
        localStamp,
        localBounds,
        respectBounds ?? false,
      );
      if (nextLocalTime !== undefined) {
        const nextWorldTime = toWorld ? toWorld(nextLocalTime) : nextLocalTime;
        playerState.resetPlayer(nextWorldTime);
      }
    },
    // Skip to the previous keyframe
    skipToPrevKeyframe: (sourceRow: SourceRow, respectBounds?: boolean) => {
      const state = get();
      const playerState = usePlayerStore.getState();
      const sourceRowId = sourceRow.id;
      const computedData = state.derivedSnapshot?.rows?.[sourceRowId]?.computed;
      if (!computedData) return;

      const instancedFrameData = computedData.virtualFrames;
      const { localStamp, localBounds, toWorld } = resolveRowTimeContext(
        state.namespaces,
        sourceRow,
        playerState.player.stamp,
        playerState.player.bounds,
      );
      const previousLocalTime = computePreviousTime(
        instancedFrameData,
        localStamp,
        localBounds,
        respectBounds ?? false,
      );
      if (previousLocalTime !== undefined) {
        const previousWorldTime = toWorld ? toWorld(previousLocalTime) : previousLocalTime;
        playerState.resetPlayer(previousWorldTime);
      }
    },
    // Skip to the start of the current bounds
    skipToStart: () => {
      const playerState = usePlayerStore.getState();
      playerState.resetPlayer(playerState.player.bounds[0]);
    },
    // Skip to the end of the current bounds
    skipToEnd: () => {
      const playerState = usePlayerStore.getState();
      playerState.resetPlayer(playerState.player.bounds[1]);
    },
    // Set the duration of the animation
    updateDuration: (duration: number) => {
      const playerState = usePlayerStore.getState();
      playerState.updateDuration(duration);
      set({ duration });
    },
    updateAnimationDuration: (animationId: string, duration: number, rescale: boolean) => {
      set(
        produce((state: AnimationData) => {
          const oldDuration = state.animations[animationId].duration;
          state.animations[animationId].duration = duration;
          if (!rescale) {
            // Adjust the stamps (percentage of completion) to match the new duration's range
            state.animations[animationId].tracks.forEach((trackId) => {
              state.tracks[trackId].points = state.tracks[trackId].points.map((point) => ({
                ...point,
                stamp: (point.stamp * oldDuration) / duration,
              }));
            });
          }
        }),
      );
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
        updateOverallDuration,
        initDerivedOrchestrator,
        updateInstancedTrackSources,
        updateTrackMuting,
        updateGlobalSources,
        updateSourceRowIds,
        updateConsolidatedSourceRow,
        updateViewFilteredGlobalRows,
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
    focusSelectionInstance: (instanceId: string) => {
      set(() => ({ selectionState: createEmptySelectionState(instanceId) }));
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
    updateHoverpointPreview: (value: number | null) => {
      set((state: AnimationData) => {
        if (value !== null) {
          const currentIdx = state.previews.findIndex((p) => p.semanticTime === SemanticTime.Hover);
          if (currentIdx < 0) {
            return {
              previews: [...state.previews, { semanticTime: SemanticTime.Hover, stamp: value }],
            };
          } else {
            return {
              previews: state.previews.map((p, idx) =>
                idx === currentIdx ? { semanticTime: SemanticTime.Hover, stamp: value } : p,
              ),
            };
          }
        } else {
          return { previews: state.previews.filter((p) => p.semanticTime !== SemanticTime.Hover) };
        }
      });
    },
    updateControlColor: (controlId: string, color: string) => {
      set(
        produce((state: AnimationData): void => {
          updateControlColor(state, controlId, color);
        }),
      );
    },
    setTrackMuted: (sourceId: string, muted: boolean) => {
      set(
        produce((state: AnimationData): void => {
          const updates: Record<string, { muted?: boolean }> = {
            [sourceId]: { muted },
          };
          if (!muted) {
            let targetTrack: ReturnType<typeof findSourceTrackById> | undefined;
            Object.values(state.sourcesByAnimationInstance).some((sources) => {
              const found = findSourceTrackById(sources, sourceId);
              if (found) {
                targetTrack = found;
                return true;
              }
              return false;
            });

            if (targetTrack) {
              const { namespaceId, animatableId } = targetTrack;
              if (animatableId) {
                Object.values(state.sourcesByAnimationInstance).forEach((sources) => {
                  collectSourceTracks(sources).forEach((track) => {
                    if (track.id === sourceId) return;
                    if (track.namespaceId !== namespaceId) return;
                    if (track.animatableId !== animatableId) return;
                    updates[track.id] = { muted: true };
                  });
                });
              }
            }
          }

          state.sourcesByAnimationInstance = mapValues(
            state.sourcesByAnimationInstance,
            (instanceSources) => computeUpdatedSources(instanceSources, updates),
          );
        }),
      );
    },
    setPreferences: (preferences: AnimationPreferencesPatch) => {
      set((state) => {
        const mergedNewKeyDefaults = preferences.newKeyDefaults
          ? {
              ...state.preferences.newKeyDefaults,
              ...preferences.newKeyDefaults,
              transitions: {
                ...state.preferences.newKeyDefaults.transitions,
                ...preferences.newKeyDefaults.transitions,
              },
            }
          : state.preferences.newKeyDefaults;

        return {
          preferences: {
            ...state.preferences,
            ...preferences,
            newKeyDefaults: mergedNewKeyDefaults,
          },
        };
      });
    },

    // Drag actions - ID-based with instance validation
    startDrag: (input: DragStartInput) => {
      set(
        produce((state: AnimationData): void => {
          startDrag(state, input);
        }),
      );
    },
    startValueDrag: (input: ValueDragStartInput) => {
      set(
        produce((state: AnimationData): void => {
          startValueDrag(state, input);
        }),
      );
    },
    startHandleDrag: (input: HandleDragStartInput) => {
      set(
        produce((state: AnimationData): void => {
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

useDefaultAnimationStore.getState().initAnimationSubscriptions();

function resolveRowTimeContext(
  namespaces: Record<string, Namespace>,
  sourceRow: SourceRow,
  worldStamp: number,
  worldBounds: [number, number],
): {
  localStamp: number;
  localBounds: [number, number];
  toWorld?: (stamp: number) => number;
} {
  const instanceId = resolveUniqueInstanceId(sourceRow);
  if (!instanceId) {
    return { localStamp: worldStamp, localBounds: worldBounds };
  }

  let settings: { timescale: number; offset: number } | undefined;
  for (const namespace of Object.values(namespaces)) {
    const instance = namespace.animationInstances[instanceId];
    if (instance) {
      const rawTimescale = instance.settings.timescale ?? 1;
      const rawOffset = instance.settings.offset ?? 0;
      const timescale = Number.isFinite(rawTimescale) && rawTimescale !== 0 ? rawTimescale : 1;
      const offset = Number.isFinite(rawOffset) ? rawOffset : 0;
      settings = {
        timescale,
        offset,
      };
      break;
    }
  }

  if (!settings) {
    return { localStamp: worldStamp, localBounds: worldBounds };
  }

  const toLocal = (stamp: number) => computeLocalStamp(stamp, settings.timescale, settings.offset);
  const toWorld = (stamp: number) => computeWorldStamp(stamp, settings.timescale, settings.offset);
  const localStamp = toLocal(worldStamp);
  const localBounds = normalizeBounds([toLocal(worldBounds[0]), toLocal(worldBounds[1])]);

  return { localStamp, localBounds, toWorld };
}

function resolveUniqueInstanceId(sourceRow: SourceRow): string | undefined {
  let uniqueId: string | undefined;
  for (const entry of sourceRow.data) {
    if (!entry.instanceId) {
      return undefined;
    }
    if (!uniqueId) {
      uniqueId = entry.instanceId;
    } else if (uniqueId !== entry.instanceId) {
      return undefined;
    }
  }
  return uniqueId;
}

function normalizeBounds(bounds: [number, number]): [number, number] {
  return bounds[0] <= bounds[1] ? bounds : [bounds[1], bounds[0]];
}

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
