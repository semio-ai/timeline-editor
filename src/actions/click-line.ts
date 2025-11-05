import { AnimationData } from "../store-types";
import {
  ComputedRowData,
  InstancedFrameInfo,
  MarkerPoint,
  KeypointAddress,
  LayerBand,
} from "../types";
import {
  createEmptySelectionState,
  addKeypoints,
  removeKeypoints,
  replaceKeypoints,
  hasAllKeypoints,
  clearSelection,
} from "../functions/selection-state-manager";
import { resolveComputedRowData } from "../utils/resolve-row-data";

/**
 * Click a transition segment (row-wide action).
 *
 * Behaviour:
 * - Operates on the entire set of foreground keypoints in the given row (not just the clicked segment span).
 * - Never updates the selection reference (reference remains whatever it previously was).
 * - Respects selectionState.instanceId; if none is set, attempts to infer a single instance from the row.
 * - Plain click:
 *   - If all row-foreground keypoints (for instance) are selected, deselect them.
 *   - Otherwise, replace the selection with the row-foreground keypoints.
 * - Cmd/Ctrl (mod) click:
 *   - Toggle the row-foreground keypoints without clearing other rows.
 * - Shift-click currently behaves like a plain click (no special range semantics for segments).
 */
export function clickLineAction(
  state: AnimationData,
  rowId: string,
  segmentId: string, // reserved for telemetry/debug; selection always acts on the whole row
  shift?: boolean,
  mod?: boolean,
): Partial<AnimationData> {
  const row: ComputedRowData | undefined = resolveComputedRowData(state, rowId);
  let selection = state.selectionState ?? createEmptySelectionState();

  // Resolve/confirm the instance to operate on.
  const instanceId = resolveInstanceIdForRow(selection.instanceId, row);

  // If we still don't have an instance, nothing to do.
  if (!instanceId) {
    return { selectionState: selection };
  }

  // Align selection instance with the resolved one.
  if (selection.instanceId !== instanceId) {
    selection = createEmptySelectionState(instanceId);
  } else if (!selection.instanceId) {
    selection = { ...selection, instanceId };
  }

  // Collect the row's foreground keypoints for the active instance.
  const rowKeypoints = collectRowForegroundKeypoints(row, instanceId);

  // No selectable foreground points; mirror clickMarkerAction behavior by clearing selection (but keep instance context).
  if (rowKeypoints.length === 0) {
    return { selectionState: clearSelection(selection) };
  }

  // Treat shift-click like a plain click for segments (no range semantics).
  const treatAsPlainClick = !mod; // shift is ignored; only mod changes behavior.

  if (treatAsPlainClick) {
    // If all row foreground points are selected, deselect them; otherwise replace with them.
    if (hasAllKeypoints(selection, rowKeypoints)) {
      const next = removeKeypoints(selection, rowKeypoints);
      // Do not modify reference on segment clicks.
      return { selectionState: { ...next, reference: selection.reference ?? null } };
    } else {
      const next = replaceKeypoints(
        selection,
        rowKeypoints,
        instanceId,
        selection.reference ?? null,
      );
      // replaceKeypoints already sets instanceId; we passed through the previous reference.
      return { selectionState: next };
    }
  }

  // Cmd/Ctrl toggle: add/remove without touching the reference or other rows.
  if (hasAllKeypoints(selection, rowKeypoints)) {
    const next = removeKeypoints(selection, rowKeypoints);
    return { selectionState: { ...next, reference: selection.reference ?? null } };
  } else {
    const next = addKeypoints(selection, rowKeypoints);
    return { selectionState: { ...next, reference: selection.reference ?? null } };
  }
}

/**
 * Try to determine the instanceId to use for a row-wide action.
 * - If an instance is already selected, keep it.
 * - Otherwise, infer from row data if exactly one instance is present.
 */
function resolveInstanceIdForRow(
  currentInstanceId: string | null,
  row: ComputedRowData | undefined,
): string | null {
  if (currentInstanceId) return currentInstanceId;
  if (!row?.virtualFrames?.length) return null;

  const ids = new Set<string>();
  for (const frame of row.virtualFrames) {
    for (const point of frame.points as MarkerPoint[]) {
      if (!point?.instanceId) continue;
      const isSelectable = point.selectable ?? true;
      if (!isSelectable) continue;
      ids.add(point.instanceId);
      if (ids.size > 1) break;
    }
    if (ids.size > 1) break;
  }

  if (ids.size === 1) {
    return ids.values().next().value ?? null;
  }
  return null;
}

/**
 * Collect all foreground-selectable keypoints in a row for the given instance.
 * Foreground is defined by LayerBand.ForegroundSelected or LayerBand.ForegroundUnselected.
 */
function collectRowForegroundKeypoints(
  row: ComputedRowData | undefined,
  instanceId: string,
): KeypointAddress[] {
  if (!row?.virtualFrames?.length) return [];

  const foregroundLayers = new Set<LayerBand>([
    LayerBand.ForegroundSelected,
    LayerBand.ForegroundUnselected,
  ]);

  const result: KeypointAddress[] = [];
  const seen = new Set<string>();

  for (const frame of row.virtualFrames as InstancedFrameInfo[]) {
    for (const point of frame.points as MarkerPoint[]) {
      if (point.instanceId !== instanceId) continue;
      const isSelectable = point.selectable ?? true;
      if (!isSelectable) continue;
      if (!foregroundLayers.has(point.layerBand as LayerBand)) continue;

      const signature = `${point.trackId}#${point.id}`;
      if (seen.has(signature)) continue;
      seen.add(signature);
      result.push({ trackId: point.trackId, keypointId: point.id });
    }
  }

  return result;
}

export default clickLineAction;
