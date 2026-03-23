import { AnimationData } from "../store-types";
import {
  SelectionState,
  SelectionAnchor,
  MarkerPoint,
  KeypointAddress,
  ComputedRowData,
} from "../types";
import {
  createEmptySelectionState,
  extractKeypoints,
  replaceKeypoints,
  addKeypoints,
  removeKeypoints,
  hasAllKeypoints,
  setReference,
  clearSelection,
  collectRangeKeypoints,
} from "../functions/selection-state-manager";

export function clickMarkerAction(
  state: AnimationData,
  clickedPoints: MarkerPoint[],
  rowId: string,
  markerId: string,
  shift?: boolean,
  mod?: boolean,
): Partial<AnimationData> {
  const anchor: SelectionAnchor = { rowId, markerId };
  let selection = state.selectionState ?? createEmptySelectionState();

  const instanceId = resolveInstanceId(selection, clickedPoints);
  if (!instanceId) {
    return { selectionState: selection };
  }

  if (selection.instanceId !== instanceId) {
    selection = createEmptySelectionState(instanceId);
  } else if (!selection.instanceId) {
    selection = { ...selection, instanceId };
  }

  const markerKeypoints = extractKeypoints(clickedPoints, instanceId);
  if (markerKeypoints.length === 0) {
    // Nothing selectable for this instance; clear selection but keep instance context.
    return { selectionState: clearSelection(selection) };
  }

  if (shift && selection.reference?.rowId === rowId) {
    const row = state.derivedSnapshot?.rows?.[rowId]?.computed;
    return {
      selectionState: handleShiftSelection(
        selection,
        anchor,
        row,
        markerKeypoints,
        instanceId,
        mod,
      ),
    };
  }

  if (mod) {
    return {
      selectionState: handleModifierToggle(selection, anchor, markerKeypoints),
    };
  }

  // Fallback for shift with mismatched row: treat as single click
  return {
    selectionState: replaceKeypoints(selection, markerKeypoints, instanceId, anchor),
  };
}

export function clearSelectionAction(state: AnimationData): Partial<AnimationData> {
  const current = state.selectionState ?? createEmptySelectionState();
  return { selectionState: clearSelection(current) };
}

function resolveInstanceId(selection: SelectionState, points: MarkerPoint[]): string | null {
  const ids = new Set(points.map((point) => point.instanceId).filter(Boolean));
  if (ids.size === 0) {
    return selection.instanceId;
  }
  if (selection.instanceId && ids.has(selection.instanceId)) {
    return selection.instanceId;
  }
  return ids.values().next().value ?? null;
}

function handleShiftSelection(
  selection: SelectionState,
  anchor: SelectionAnchor,
  row: ComputedRowData | undefined,
  markerKeypoints: KeypointAddress[],
  instanceId: string,
  extend?: boolean,
): SelectionState {
  const reference = selection.reference!;
  const rangeKeypoints = collectRangeKeypoints(
    row,
    instanceId,
    reference.markerId,
    anchor.markerId,
  );

  if (rangeKeypoints.length === 0) {
    // No range resolved; fall back to simple replace using current marker.
    return replaceKeypoints(selection, markerKeypoints, instanceId, anchor);
  }

  if (extend) {
    const next = addKeypoints(selection, rangeKeypoints);
    return setReference(next, reference);
  }

  const tracksToReplace = new Set(rangeKeypoints.map((kp) => kp.trackId));
  let baseSelection = selection;

  if (tracksToReplace.size > 0) {
    const removal: KeypointAddress[] = [];
    selection.keypoints.forEach((ids, trackId) => {
      if (!tracksToReplace.has(trackId)) return;
      ids.forEach((keypointId) => {
        removal.push({ trackId, keypointId });
      });
    });

    if (removal.length > 0) {
      baseSelection = removeKeypoints(selection, removal);
    }
  }

  const next = addKeypoints(baseSelection, rangeKeypoints);
  return setReference(next, reference);
}

function handleModifierToggle(
  selection: SelectionState,
  anchor: SelectionAnchor,
  markerKeypoints: KeypointAddress[],
): SelectionState {
  const alreadySelected = hasAllKeypoints(selection, markerKeypoints);

  if (alreadySelected) {
    const next = removeKeypoints(selection, markerKeypoints);
    const isReference =
      selection.reference?.rowId === anchor.rowId &&
      selection.reference?.markerId === anchor.markerId;
    return setReference(next, isReference ? null : (selection.reference ?? null));
  }

  const next = addKeypoints(selection, markerKeypoints);
  return setReference(next, anchor);
}
