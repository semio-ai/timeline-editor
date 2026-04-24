import { RawValue, usePlayerStore, AnimatableValue, useValuesStore } from "@semio/utils";
import { TimeDisplay } from "@semio/ui";
import { subscribeWithSelector } from "zustand/middleware";
import { produce, enableMapSet } from "immer";
import { create } from "zustand";
import { uniq } from "lodash";
import {
  Track,
  StoredAnimation,
  Source,
  SourceGroup,
  SemanticTime,
  Preview,
  SourceRow,
  TrackRender,
  LayerBand,
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
  applyTrackDiffOpsToTrack,
} from "./functions";
import type { TrackDiffOp } from "./types/util/diff";
import { resolveAnimationDuration } from "./functions/compute-animation-extent";
import {
  updatePlayerLoop,
  updateOverallDuration,
  updateInstancedTrackSources,
  updateViewFilteredSourceRows,
  updateGlobalSources,
  updateSourceRowIds,
  updateTrackMuting,
  initDerivedOrchestrator,
  updateActiveEntityContext,
} from "./subscriptions";
import { View } from "./types/util/view";
import { createEmptySelectionState } from "./functions/selection-state-manager";
import { clickLineAction } from "./actions/click-line";
import { parseTrackKey } from "./utils/track-key";
import { GROUP_TYPES } from "./constants";

enableMapSet();

/**
 * Collects the set of track IDs that are currently locked (read-only),
 * based on source-row metadata. Used to filter out locked tracks from
 * any edit operation before it reaches the diff pipeline.
 */
function getLockedTrackIds(sourceRows: Record<string, SourceRow>): Set<string> {
  const locked = new Set<string>();
  Object.values(sourceRows).forEach((row) =>
    row.data.forEach((d) => {
      if (d.locked) locked.add(d.trackId);
    }),
  );
  return locked;
}

/**
 * Hit-test keypoints against the current box-select bounds and return the
 * resulting selection keypoints map based on the box mode.
 */
function computeBoxSelectHitTest(
  state: AnimationData,
  box: BoxSelectState,
): Map<string, Set<string>> {
  const { layout } = box;
  const view = state.editorViews[layout.viewId];
  const trackRender = view?.trackRender ?? TrackRender.Key;
  const isTimeline = box.origin === "timeline";

  const minStamp = Math.min(box.startStamp, box.currentStamp);
  const maxStamp = Math.max(box.startStamp, box.currentStamp);
  const minY = Math.min(box.startY, box.currentY);
  const maxY = Math.max(box.startY, box.currentY);

  // Layout for Y hit-testing (pixel-based, matching the renderer's 1:1 pixel-to-world)
  const canvasHeight = layout.canvasHeight;
  const trackWorldHeight = layout.trackHeightPx;
  const firstRowCenterY =
    canvasHeight / 2 - layout.topOffsetPx - trackWorldHeight / 2 + state.scrollOffset;
  // Spline layout: group Y and available height are stable pixel-based values
  const availableHeightPx = canvasHeight - layout.topOffsetPx - layout.bottomOffsetPx;
  const splineGroupY = (layout.bottomOffsetPx - layout.topOffsetPx) / 2;

  const viewRowIds = state.sourceRowIdsByView[layout.viewId] ?? state.sourceRowIds;
  const rowIds = isTimeline
    ? ["global"]
    : trackRender === TrackRender.Spline
      ? viewRowIds.spline
      : viewRowIds.flat;

  // Collect hit keypoints
  const hits: { trackId: string; keypointId: string }[] = [];

  rowIds.forEach((rowId, idx) => {
    const sourceRow = state.instancedTrackSources[rowId];
    if (!sourceRow) return;

    // Compute this row's center Y for non-spline modes
    let rowCenterY = 0;
    if (!isTimeline && trackRender !== TrackRender.Spline) {
      rowCenterY = firstRowCenterY - trackWorldHeight * idx;
      // Quick reject: if the row center is far outside the box, skip
      if (rowCenterY > maxY + trackWorldHeight / 2 || rowCenterY < minY - trackWorldHeight / 2)
        return;
    }

    const computed = state.derivedSnapshot?.rows?.[rowId]?.computed;
    if (!computed) return;

    computed.virtualFrames.forEach((frame) => {
      const stamp = frame.stamp;
      if (stamp < minStamp || stamp > maxStamp) return;

      frame.points.forEach((point) => {
        if (point.selectable === false) return;
        if (
          point.layerBand !== LayerBand.ForegroundSelected &&
          point.layerBand !== LayerBand.ForegroundUnselected
        )
          return;
        if (state.selectionState.instanceId && point.instanceId !== state.selectionState.instanceId)
          return;

        // Y hit-test: check the keypoint's visual center, not the row band
        if (!isTimeline) {
          if (trackRender === TrackRender.Spline) {
            // Spline: keypoint world Y is stable regardless of camera zoom.
            // The renderer positions the group at (bottomOffsetPx - topOffsetPx) / 2
            // and uses pixel-based availableHeight for the linearScale range.
            if (typeof point.value !== "number") return;

            const viewAxis = computed.verticalAxisByView?.[layout.viewId];
            const domainMin = viewAxis?.min ?? computed.verticalBounds.min;
            const domainMax = viewAxis?.max ?? computed.verticalBounds.max;
            const domainSpan = domainMax - domainMin;
            if (domainSpan <= 0) return;

            const visualScale = viewAxis?.visualScale ?? 1;
            const visualOffset = viewAxis?.visualOffset ?? 0;
            const span = Math.max(availableHeightPx * visualScale, 1);
            const halfSpan = span / 2;
            const t = ((point.value as number) - domainMin) / domainSpan;
            const localY = -halfSpan + visualOffset + t * span;
            const pointY = splineGroupY + localY;

            if (pointY < minY || pointY > maxY) return;
          } else {
            // Key/Preview/Transition: center Y is the row center
            if (rowCenterY < minY || rowCenterY > maxY) return;
          }
        }

        hits.push({ trackId: point.trackId, keypointId: point.id });
      });
    });
  });

  // Apply selection mode against the initial snapshot
  const initial = box.initialKeypoints;

  if (box.mode === "replace") {
    const result = new Map<string, Set<string>>();
    hits.forEach(({ trackId, keypointId }) => {
      const existing = result.get(trackId) ?? new Set<string>();
      existing.add(keypointId);
      result.set(trackId, existing);
    });
    return result;
  }

  if (box.mode === "add") {
    const result = new Map<string, Set<string>>();
    initial.forEach((ids, trackId) => result.set(trackId, new Set(ids)));
    hits.forEach(({ trackId, keypointId }) => {
      const existing = result.get(trackId) ?? new Set<string>();
      existing.add(keypointId);
      result.set(trackId, existing);
    });
    return result;
  }

  // Toggle: start from initial, toggle each hit
  const result = new Map<string, Set<string>>();
  initial.forEach((ids, trackId) => result.set(trackId, new Set(ids)));
  const hitSet = new Set(hits.map((h) => `${h.trackId}:${h.keypointId}`));
  hits.forEach(({ trackId, keypointId }) => {
    const key = `${trackId}:${keypointId}`;
    if (!hitSet.has(key)) return; // dedup
    hitSet.delete(key);
    const wasSelected = initial.get(trackId)?.has(keypointId) ?? false;
    const existing = result.get(trackId) ?? new Set<string>();
    if (wasSelected) {
      existing.delete(keypointId);
      if (existing.size === 0) result.delete(trackId);
      else result.set(trackId, existing);
    } else {
      existing.add(keypointId);
      result.set(trackId, existing);
    }
  });
  return result;
}

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

function collectLegacyHiddenTrackIds(
  globalSourceTree: AnimationData["globalSourceTree"],
): string[] {
  const hiddenIds = new Set<string>();
  collectSourceTracks(globalSourceTree).forEach((track) => {
    if (track.hidden) {
      hiddenIds.add(track.id);
    }
  });
  return Array.from(hiddenIds);
}

function resolveTrackIdsForVisibilityUpdate(
  globalSourceTree: AnimationData["globalSourceTree"],
  sourceId: string,
): string[] {
  const trackIds = new Set<string>();

  const visit = (sources: Source[]): void => {
    sources.forEach((source) => {
      if (GROUP_TYPES.has(source.type)) {
        const sourceGroup = source as SourceGroup;
        if (source.id === sourceId) {
          collectSourceTracks([source]).forEach((track) => {
            trackIds.add(track.id);
          });
          return;
        }
        visit(sourceGroup.children);
        return;
      }
      if (source.id === sourceId) {
        trackIds.add(source.id);
      }
    });
  };

  visit(globalSourceTree);

  return Array.from(trackIds);
}

function normalizeEditorViewOrder(
  viewOrder: string[],
  editorViews: Record<string, View>,
): string[] {
  const ordered: string[] = [];
  viewOrder.forEach((id) => {
    if (!editorViews[id] || ordered.includes(id)) return;
    ordered.push(id);
  });
  Object.keys(editorViews).forEach((id) => {
    if (!ordered.includes(id)) {
      ordered.push(id);
    }
  });
  return ordered;
}

export const AnimationSlice = (
  set: AnimationStoreSetter,
  get: AnimationStoreGetter,
  api: AnimationApi,
) => {
  return {
    ...createDefaultState(),
    updateSource: (groupId: string, expanded?: boolean, hidden?: boolean) => {
      void hidden;
      set(
        produce((state: AnimationData) => {
          // Group expansion is global; track visibility is managed per-view.
          const updates = { [groupId]: { expanded } };
          state.globalSourceTree = computeUpdatedSources(state.globalSourceTree, updates);
        }),
      );
    },
    updateSources: (updates: Record<string, { expanded?: boolean; hidden?: boolean }>) => {
      set(
        produce((state: AnimationData) => {
          // Global source updates only carry expansion; hidden is now view-specific.
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
    updateViewTrackVisibility: (viewId: string, updates: Record<string, { hidden?: boolean }>) => {
      set(
        produce((state: AnimationData) => {
          const view = state.editorViews[viewId];
          if (!view) return;

          const hiddenSet = new Set(view.hiddenSourceTrackIds ?? []);
          Object.entries(updates).forEach(([sourceId, update]) => {
            if (update.hidden === undefined) return;
            const resolvedTrackIds = resolveTrackIdsForVisibilityUpdate(
              state.globalSourceTree,
              sourceId,
            );
            resolvedTrackIds.forEach((trackId) => {
              if (update.hidden) {
                hiddenSet.add(trackId);
              } else {
                hiddenSet.delete(trackId);
              }
            });
          });

          state.editorViews[viewId] = {
            ...view,
            hiddenSourceTrackIds: Array.from(hiddenSet),
          };
        }),
      );
    },
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
        const legacyHiddenIds =
          Object.keys(state.editorViews).length === 0
            ? collectLegacyHiddenTrackIds(state.globalSourceTree)
            : [];
        const defaultView: View = {
          id: view.id,
          name: view.name,
          trackRender: view.trackRender ?? TrackRender.Key,
          verticalAxis: view.verticalAxis ?? VerticalAxis.Normalized,
          hiddenSourceTrackIds: view.hiddenSourceTrackIds ?? legacyHiddenIds,
          trackFilter: view.trackFilter ?? "",
        };
        const nextViews = {
          ...state.editorViews,
          [view.id]: { ...defaultView, ...view },
        };
        const nextOrder = normalizeEditorViewOrder(
          state.editorViewOrder.includes(view.id)
            ? state.editorViewOrder
            : [...state.editorViewOrder, view.id],
          nextViews,
        );
        return {
          editorViews: nextViews,
          editorViewOrder: nextOrder,
          activeEditorViewId: state.activeEditorViewId ?? nextOrder[0],
        };
      });
    },
    replaceEditorViews: (next: EditorViewState) => {
      set(
        produce((state: AnimationData) => {
          const nextViews: Record<string, View> = {};
          next.views.forEach((view) => {
            if (!view.id || nextViews[view.id]) return;
            nextViews[view.id] = {
              id: view.id,
              name: view.name,
              trackRender: view.trackRender ?? TrackRender.Key,
              verticalAxis: view.verticalAxis ?? VerticalAxis.Normalized,
              hiddenSourceTrackIds: [...(view.hiddenSourceTrackIds ?? [])],
              trackFilter: view.trackFilter ?? "",
            };
          });
          if (Object.keys(nextViews).length === 0) {
            nextViews["view-1"] = {
              id: "view-1",
              name: "View 1",
              trackRender: TrackRender.Key,
              verticalAxis: VerticalAxis.Normalized,
              hiddenSourceTrackIds: [],
              trackFilter: "",
            };
          }
          const nextOrder = normalizeEditorViewOrder(next.viewOrder, nextViews);
          const nextActive =
            next.activeViewId && nextOrder.includes(next.activeViewId)
              ? next.activeViewId
              : nextOrder[0];
          state.editorViews = nextViews;
          state.editorViewOrder = nextOrder;
          state.activeEditorViewId = nextActive;
        }),
      );
    },
    setActiveEditorView: (viewId: string) => {
      set(
        produce((state: AnimationData) => {
          if (!state.editorViews[viewId]) return;
          state.activeEditorViewId = viewId;
        }),
      );
    },
    updateView: (viewId: string, view: Partial<View>) => {
      set(
        produce((state: AnimationData) => {
          if (!state.editorViews[viewId]) return;
          state.editorViews[viewId] = {
            ...state.editorViews[viewId],
            ...view,
            hiddenSourceTrackIds:
              view.hiddenSourceTrackIds ?? state.editorViews[viewId].hiddenSourceTrackIds,
          };
        }),
      );
    },
    removeView: (viewId: string) => {
      set(
        produce((state: AnimationData) => {
          if (!state.editorViews[viewId]) return;
          if (Object.keys(state.editorViews).length <= 1) return;
          const { [viewId]: _, ...rest } = state.editorViews;
          state.editorViews = rest;
          state.editorViewOrder = normalizeEditorViewOrder(
            state.editorViewOrder.filter((id) => id !== viewId),
            state.editorViews,
          );
          if (state.activeEditorViewId === viewId) {
            state.activeEditorViewId = state.editorViewOrder[0];
          }
        }),
      );
    },
    setVerticalViewport: (
      viewId: string,
      viewport: { top: number; bottom: number } | undefined,
    ) => {
      set(
        produce((state: AnimationData) => {
          const view = state.editorViews[viewId];
          if (!view) return;
          view.verticalViewport = viewport;
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
      // Filter out locked tracks
      const sourceRows = get().instancedTrackSources;
      const lockedTrackIds = new Set<string>();
      Object.values(sourceRows).forEach((row) =>
        row.data.forEach((d) => {
          if (d.locked) lockedTrackIds.add(d.trackId);
        }),
      );
      const unlocked = keypoints.filter((k) => !lockedTrackIds.has(k.trackId));
      if (unlocked.length === 0) return;
      set(
        produce((state: AnimationData): void => {
          unlocked.forEach(({ trackId, keypointId }) => {
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
          const animation = state.animations[animationId];
          if (!animation) return;

          if (rescale) {
            // Rescale stamps proportionally to maintain relative positions.
            const oldExtent = resolveAnimationDuration(animation, state.tracks);
            if (oldExtent > 0 && duration > 0) {
              const scale = duration / oldExtent;
              animation.tracks.forEach((trackId) => {
                state.tracks[trackId].points = state.tracks[trackId].points.map((point) => ({
                  ...point,
                  stamp: point.stamp * scale,
                }));
              });
            }
          }
          // Update the viewport extent hint
          animation.defaultViewportExtent = duration;
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
      // Check if track is locked via source row data
      const sourceRows = get().instancedTrackSources;
      const isLocked = Object.values(sourceRows).some((row) =>
        row.data.some((d) => d.trackId === trackId && d.locked),
      );
      if (isLocked) return;
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
    copySelection: () => {
      const state = get();
      const { keypoints: selectedMap, instanceId } = state.selectionState;
      if (selectedMap.size === 0) return;

      // Look up instance timing for world-stamp conversion
      let timescale = 1;
      let offset = 0;
      if (instanceId) {
        for (const namespace of Object.values(state.namespaces)) {
          const instance = namespace.animationInstances[instanceId];
          if (instance) {
            timescale = instance.settings.timescale ?? 1;
            if (!Number.isFinite(timescale) || timescale === 0) timescale = 1;
            offset = instance.settings.offset ?? 0;
            if (!Number.isFinite(offset)) offset = 0;
            break;
          }
        }
      }

      // Collect keypoints and convert to world-time stamps
      const trackEntries: { key: string; worldStamps: { stamp: number; value: any; transitions: any }[] }[] = [];
      let minWorldStamp = Infinity;

      const sortedTrackKeys = Array.from(selectedMap.keys()).sort();
      for (const trackKey of sortedTrackKeys) {
        const keypointIds = selectedMap.get(trackKey);
        if (!keypointIds || keypointIds.size === 0) continue;
        const track = state.tracks[trackKey];
        if (!track) continue;

        const collected: { stamp: number; value: any; transitions: any }[] = [];
        for (const point of track.points) {
          if (!keypointIds.has(point.id)) continue;
          const worldStamp = computeWorldStamp(point.stamp, timescale, offset);
          if (worldStamp < minWorldStamp) minWorldStamp = worldStamp;
          collected.push({
            stamp: worldStamp,
            value: point.value,
            transitions: point.transitions ? structuredClone(point.transitions) : undefined,
          });
        }
        if (collected.length > 0) {
          trackEntries.push({ key: trackKey, worldStamps: collected });
        }
      }

      if (trackEntries.length === 0) return;

      // Convert to offset-from-anchor format. Stamps are stored relative to
      // the earliest selected keypoint across all tracks, so paste can be
      // anchored to an arbitrary playhead position without losing the inter-
      // keypoint spacing or the relative ordering across tracks. World-time
      // is used (not local) so a paste into an instance with a different
      // timescale/offset still preserves the *real-time* shape of the copy.
      const clipboardTracks = trackEntries.map((entry, idx) => ({
        sourceTrackKey: entry.key,
        trackIndex: idx,
        keypoints: entry.worldStamps.map((kp) => ({
          stampOffset: kp.stamp - minWorldStamp,
          value: kp.value,
          transitions: kp.transitions,
        })),
      }));

      set({ clipboard: { tracks: clipboardTracks, instanceId } });
    },
    cutSelection: () => {
      // Copy then delete. Delete respects locked tracks.
      get().copySelection();
      get().deleteSelection();
    },
    pasteAtStamp: (worldStamp: number) => {
      set(
        produce((state: AnimationData): void => {
          const clipboard = state.clipboard;
          if (!clipboard || clipboard.tracks.length === 0) return;

          const lockedTrackIds = getLockedTrackIds(get().instancedTrackSources);

          // Determine if we're pasting to selected tracks (cross-track) or source tracks
          const selectedTrackKeys = Array.from(state.selectionState.keypoints.keys()).sort();
          const useCrossTrackPaste = selectedTrackKeys.length > 0;

          // Look up instance timing for the target
          const { instanceId } = state.selectionState;
          let timescale = 1;
          let offset = 0;
          if (instanceId) {
            for (const namespace of Object.values(state.namespaces)) {
              const instance = namespace.animationInstances[instanceId];
              if (instance) {
                timescale = instance.settings.timescale ?? 1;
                if (!Number.isFinite(timescale) || timescale === 0) timescale = 1;
                offset = instance.settings.offset ?? 0;
                if (!Number.isFinite(offset)) offset = 0;
                break;
              }
            }
          }

          const newSelection = new Map<string, Set<string>>();

          for (const clipTrack of clipboard.tracks) {
            // Resolve target track
            // TODO(animation-usability): cross-instance paste — map by
            // animatable path/id rather than positional index so a copy from
            // instance A's "scale" lands on instance B's "scale" when the
            // selection contains an arbitrary set of tracks. The current
            // index mapping silently writes to the wrong animatable when the
            // selection ordering doesn't line up with the clipboard.
            let targetTrackKey: string;
            if (useCrossTrackPaste) {
              // Map by index: clipboard trackIndex → selected track at same index
              if (clipTrack.trackIndex >= selectedTrackKeys.length) continue;
              targetTrackKey = selectedTrackKeys[clipTrack.trackIndex];
            } else {
              targetTrackKey = clipTrack.sourceTrackKey;
            }

            // Skip locked tracks — no edits allowed
            if (lockedTrackIds.has(targetTrackKey)) continue;

            const track = state.tracks[targetTrackKey];
            if (!track) continue;

            // Build diff ops: delete coincident points, then insert new ones.
            const diffs: TrackDiffOp[] = [];
            const trackSelection = new Set<string>();

            for (const clipKp of clipTrack.keypoints) {
              const targetWorldStamp = worldStamp + clipKp.stampOffset;
              const localStamp = computeLocalStamp(targetWorldStamp, timescale, offset);

              // Delete existing keypoints within 1ms of paste stamp (replace behavior)
              track.points.forEach((p) => {
                if (Math.abs(p.stamp - localStamp) <= 1) {
                  diffs.push({ type: "deleteKeypoint", trackId: targetTrackKey, keypointId: p.id });
                }
              });

              const newId = crypto.randomUUID();
              diffs.push({
                type: "insertKeypoint",
                trackId: targetTrackKey,
                keypoint: {
                  id: newId,
                  stamp: localStamp,
                  value: clipKp.value,
                  transitions: clipKp.transitions ?? undefined,
                },
              });
              trackSelection.add(newId);
            }

            applyTrackDiffOpsToTrack(track, diffs);
            // Re-sort by stamp after insertions
            track.points.sort((a, b) => a.stamp - b.stamp);

            if (trackSelection.size > 0) {
              newSelection.set(targetTrackKey, trackSelection);
            }
          }

          // Select the newly pasted keypoints
          if (newSelection.size > 0) {
            state.selectionState = {
              ...state.selectionState,
              keypoints: newSelection,
              reference: null,
            };
          }
        }),
      );
    },
    deleteSelection: () => {
      const lockedTrackIds = getLockedTrackIds(get().instancedTrackSources);
      set(
        produce((state: AnimationData): void => {
          const selected = state.selectionState.keypoints;
          if (selected.size === 0) return;

          // Group deletes by track so we can apply as a single diff batch per track
          const diffsByTrack = new Map<string, TrackDiffOp[]>();
          selected.forEach((keypointIds, trackId) => {
            if (lockedTrackIds.has(trackId)) return;
            const list: TrackDiffOp[] = [];
            keypointIds.forEach((keypointId) => {
              list.push({ type: "deleteKeypoint", trackId, keypointId });
            });
            if (list.length > 0) diffsByTrack.set(trackId, list);
          });

          diffsByTrack.forEach((diffs, trackId) => {
            const track = state.tracks[trackId];
            if (!track) return;
            applyTrackDiffOpsToTrack(track, diffs);
          });

          // Clear selection for tracks whose keypoints were removed; preserve
          // selection entries for locked tracks (their keypoints still exist).
          const nextSelection = new Map<string, Set<string>>();
          selected.forEach((keypointIds, trackId) => {
            if (lockedTrackIds.has(trackId)) {
              nextSelection.set(trackId, new Set(keypointIds));
            }
          });
          state.selectionState = {
            ...state.selectionState,
            keypoints: nextSelection,
            reference: null,
          };
        }),
      );
    },
    selectAll: () => {
      set(
        produce((state: AnimationData): void => {
          const { instanceId } = state.selectionState;
          const newKeypoints = new Map<string, Set<string>>();
          for (const [trackKey, track] of Object.entries(state.tracks)) {
            const belongsToInstance = !instanceId || Object.values(state.instancedTrackSources).some(
              (row) => row.data.some((d) => d.trackId === trackKey && d.instanceId === instanceId),
            );
            if (belongsToInstance && track.points.length > 0) {
              newKeypoints.set(trackKey, new Set(track.points.map((p) => p.id)));
            }
          }
          state.selectionState.keypoints = newKeypoints;
        }),
      );
    },
    selectAllInTracks: (trackKeys: string[]) => {
      set(
        produce((state: AnimationData): void => {
          const newKeypoints = new Map<string, Set<string>>();
          for (const trackKey of trackKeys) {
            const track = state.tracks[trackKey];
            if (track && track.points.length > 0) {
              newKeypoints.set(trackKey, new Set(track.points.map((p) => p.id)));
            }
          }
          state.selectionState.keypoints = newKeypoints;
        }),
      );
    },
    focusSelectionInstance: (instanceId: string) => {
      set(() => ({ selectionState: createEmptySelectionState(instanceId) }));
    },
    setActiveEntity: (entityId: string | null) => {
      const current = get();
      if (current.activeEntityId === entityId) return;
      set((state: AnimationData) => {
        if (entityId === null) {
          return {
            activeEntityId: null,
            selectionState: createEmptySelectionState(null),
          };
        }
        const entityState = state.entityStates[entityId];
        const instanceId =
          entityState?.controlMode === "animation" ? (entityState.activeInstanceId ?? null) : null;
        return {
          activeEntityId: entityId,
          selectionState: createEmptySelectionState(instanceId),
        };
      });
    },
    setEntityControlMode: (entityId: string, mode: "direct" | "animation", instanceId?: string) => {
      const currentEntityState = get().entityStates[entityId];
      const resolvedInstanceId = mode === "animation" ? (instanceId ?? null) : null;
      if (
        currentEntityState?.controlMode === mode &&
        currentEntityState?.activeInstanceId === resolvedInstanceId
      ) {
        return;
      }
      set((state: AnimationData) => {
        const newEntityStates = {
          ...state.entityStates,
          [entityId]: {
            controlMode: mode,
            activeInstanceId: mode === "animation" ? (instanceId ?? null) : null,
          },
        };

        // If this is the active entity, also update selection instance
        if (state.activeEntityId === entityId) {
          const newInstanceId = mode === "animation" ? (instanceId ?? null) : null;
          return {
            entityStates: newEntityStates,
            selectionState: createEmptySelectionState(newInstanceId),
          };
        }

        return { entityStates: newEntityStates };
      });
    },
    setEntityStates: (states: Record<string, EntityAnimationState>) => {
      set((state: AnimationData) => ({
        entityStates: { ...state.entityStates, ...states },
      }));
    },
    setEmphasis: (rowId: string | null) => {
      set(() => ({ emphasisRowId: rowId }));
    },
    selectTrack: (rowId: string, trackIds: string[]) => {
      set(
        produce((state: AnimationData) => {
          const newKeypoints = new Map<string, Set<string>>();
          trackIds.forEach((id) => newKeypoints.set(id, new Set<string>()));
          state.selectionState.keypoints = newKeypoints;
          state.selectionState.reference = { rowId, markerId: rowId };
        }),
      );
    },
    toggleTrackInSelection: (rowId: string, trackIds: string[]) => {
      set(
        produce((state: AnimationData) => {
          // If all trackIds are already in keypoints, remove them; otherwise add them
          const allPresent = trackIds.every((id) => state.selectionState.keypoints.has(id));
          if (allPresent) {
            trackIds.forEach((id) => state.selectionState.keypoints.delete(id));
          } else {
            trackIds.forEach((id) => {
              if (!state.selectionState.keypoints.has(id)) {
                state.selectionState.keypoints.set(id, new Set<string>());
              }
            });
          }
          state.selectionState.reference = { rowId, markerId: rowId };
        }),
      );
    },
    rangeSelectTracks: (fromRowId: string, toRowId: string) => {
      set(
        produce((state: AnimationData) => {
          const flat = state.sourceRowIds.flat;
          const fromIndex = flat.indexOf(fromRowId);
          const toIndex = flat.indexOf(toRowId);
          if (fromIndex === -1 || toIndex === -1) return;

          const start = Math.min(fromIndex, toIndex);
          const end = Math.max(fromIndex, toIndex);
          const rangeIds = flat.slice(start, end + 1);

          // Resolve each row's trackIds from instancedTrackSources
          const newKeypoints = new Map<string, Set<string>>();
          rangeIds.forEach((id) => {
            const row = state.instancedTrackSources[id];
            if (row) {
              const rowTrackIds = uniq(row.data.map((d) => d.trackId));
              rowTrackIds.forEach((tid) => newKeypoints.set(tid, new Set<string>()));
            }
          });
          state.selectionState.keypoints = newKeypoints;
        }),
      );
    },
    startBoxSelect: (boxState: BoxSelectState) => {
      // Snapshot the current selection for toggle mode
      const currentKeypoints = get().selectionState.keypoints;
      const initialKeypoints = new Map<string, Set<string>>();
      currentKeypoints.forEach((ids, trackId) => {
        initialKeypoints.set(trackId, new Set(ids));
      });
      set({ boxSelectState: { ...boxState, initialKeypoints } });
    },
    updateBoxSelect: (currentStamp: number, currentY: number) => {
      const state = get();
      const box = state.boxSelectState;
      if (!box) return;

      const updatedBox = { ...box, currentStamp, currentY };
      const newSelection = computeBoxSelectHitTest(state, updatedBox);

      // Only update selectionState if the hit results actually changed
      const currentKeypoints = state.selectionState.keypoints;
      let selectionChanged = newSelection.size !== currentKeypoints.size;
      if (!selectionChanged) {
        for (const [trackId, ids] of newSelection) {
          const existing = currentKeypoints.get(trackId);
          if (!existing || existing.size !== ids.size) {
            selectionChanged = true;
            break;
          }
          for (const id of ids) {
            if (!existing.has(id)) {
              selectionChanged = true;
              break;
            }
          }
          if (selectionChanged) break;
        }
      }

      if (selectionChanged) {
        set({
          boxSelectState: updatedBox,
          selectionState: {
            ...state.selectionState,
            keypoints: newSelection,
            reference: box.mode === "replace" ? null : state.selectionState.reference,
          },
        });
      } else {
        // Just update box position for the overlay, no selection churn
        set({ boxSelectState: updatedBox });
      }
    },
    cancelBoxSelect: () => {
      const state = get();
      const box = state.boxSelectState;
      if (!box) return;
      // Restore the initial selection from before the drag
      set({
        boxSelectState: null,
        selectionState: {
          ...state.selectionState,
          keypoints: box.initialKeypoints,
        },
      });
    },
    commitBoxSelect: () => {
      // Selection is already live-updated — just clear the box state
      set({ boxSelectState: null });
    },
    setScrollOffset: (offset: number) => {
      set({ scrollOffset: offset });
    },
    setBoxSelectPending: (pending: boolean) => {
      set({ boxSelectPending: pending });
    },
    requestVerticalFit: () => {
      set((state: AnimationData) => ({ verticalFitCounter: state.verticalFitCounter + 1 }));
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
    setTracksMuted: (sourceIds: string | string[], muted: boolean) => {
      const ids = Array.isArray(sourceIds) ? sourceIds : [sourceIds];
      set(
        produce((state: AnimationData): void => {
          const updates: Record<string, { muted?: boolean }> = {};
          ids.forEach((sourceId) => {
            updates[sourceId] = { muted };
          });

          // When unmuting, enforce one-unmuted-per-animatable constraint:
          // mute other tracks that share the same animatable in the same namespace.
          if (!muted) {
            ids.forEach((sourceId) => {
              const targetTrack = findSourceTrackById(state.globalSourceTree, sourceId);
              if (targetTrack) {
                const { namespaceId, animatableId } = targetTrack;
                if (animatableId) {
                  collectSourceTracks(state.globalSourceTree).forEach((track) => {
                    if (ids.includes(track.id)) return;
                    if (track.namespaceId !== namespaceId) return;
                    if (track.animatableId !== animatableId) return;
                    updates[track.id] = { muted: true };
                  });
                }
              }
            });
          }

          state.globalSourceTree = computeUpdatedSources(state.globalSourceTree, updates);
        }),
      );
    },
    setTracksVisible: (sourceIds: string | string[], visible: boolean) => {
      const ids = Array.isArray(sourceIds) ? sourceIds : [sourceIds];
      set(
        produce((state: AnimationData): void => {
          const updates: Record<string, { visible?: boolean }> = {};
          ids.forEach((id) => {
            updates[id] = { visible };
          });
          state.globalSourceTree = computeUpdatedSources(state.globalSourceTree, updates);
        }),
      );
    },
    setTracksLocked: (sourceIds: string | string[], locked: boolean) => {
      const ids = Array.isArray(sourceIds) ? sourceIds : [sourceIds];
      set(
        produce((state: AnimationData): void => {
          const updates: Record<string, { locked?: boolean }> = {};
          ids.forEach((id) => {
            updates[id] = { locked };
          });
          state.globalSourceTree = computeUpdatedSources(state.globalSourceTree, updates);
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
