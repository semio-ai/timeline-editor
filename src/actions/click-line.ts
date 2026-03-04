import { AnimationData } from "../store-types";
import { ComputedRowData } from "../types";
import {
  createEmptySelectionState,
  addKeypoints,
  removeKeypoints,
  replaceKeypoints,
  hasAllKeypoints,
  clearSelection,
  collectRowForegroundKeypoints,
  resolveSelectionInstanceIdForRow,
} from "../functions/selection-state-manager";

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
  const row: ComputedRowData | undefined = state.derivedSnapshot?.rows?.[rowId]?.computed;
  let selection = state.selectionState ?? createEmptySelectionState();

  // Resolve/confirm the instance to operate on.
  const instanceId = resolveSelectionInstanceIdForRow(selection, row);

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
