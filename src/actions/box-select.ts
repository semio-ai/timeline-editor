import type {
  AnimationData,
  AnimationStoreGetter,
  AnimationStoreSetter,
  BoxSelectState,
} from "../store-types";
import { LayerBand, TrackRender } from "../types";

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

export function startBoxSelect(
  set: AnimationStoreSetter,
  get: AnimationStoreGetter,
  boxState: BoxSelectState,
): void {
  // Snapshot the current selection for toggle mode
  const currentKeypoints = get().selectionState.keypoints;
  const initialKeypoints = new Map<string, Set<string>>();
  currentKeypoints.forEach((ids, trackId) => {
    initialKeypoints.set(trackId, new Set(ids));
  });
  set({ boxSelectState: { ...boxState, initialKeypoints } });
}

export function updateBoxSelect(
  set: AnimationStoreSetter,
  get: AnimationStoreGetter,
  currentStamp: number,
  currentY: number,
): void {
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
}

export function cancelBoxSelect(set: AnimationStoreSetter, get: AnimationStoreGetter): void {
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
}

export function commitBoxSelect(set: AnimationStoreSetter): void {
  // Selection is already live-updated — just clear the box state
  set({ boxSelectState: null });
}

export function setBoxSelectPending(set: AnimationStoreSetter, pending: boolean): void {
  set({ boxSelectPending: pending });
}
