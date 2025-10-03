import type { DraggedKeypoint, DragState } from "../../types";
import type { AnimationData } from "../../store-types";
import { getMarkerById, getMarkerInstanceId } from "../../functions/marker-utils";
import { parseMarkerPath } from "../../functions/selection-state-manager";

/**
 * Start a drag operation with the current selection or provided marker IDs.
 * All positions are stored in normalized 0-1 space.
 *
 * @param state - The animation state to modify
 * @param markerIds - Optional array of marker IDs to drag, defaults to current selection
 */
export function startDragging(state: AnimationData, markerIds?: string[]): void {
  // If no IDs provided, use current selection from active instance
  let idsToUse: string[] = [];
  let sourceRowIds: string[] = [];

  if (markerIds) {
    // Use provided marker IDs and find their source rows
    // For now, we'll need to find the source rows by searching through computedRowData
    idsToUse = markerIds;
    sourceRowIds = markerIds.map((markerId) => {
      // Find the source row that contains this marker
      for (const [rowId, rowData] of Object.entries(state.computedRowData)) {
        if (rowData.virtualFrames?.some((f) => f.id === markerId)) {
          return rowId;
        }
      }
      return "";
    });

    // Filter out any markers that couldn't be found
    const validPairs = idsToUse
      .map((id, idx) => ({ id, sourceRowId: sourceRowIds[idx] }))
      .filter((pair) => pair.sourceRowId !== "");

    idsToUse = validPairs.map((p) => p.id);
    sourceRowIds = validPairs.map((p) => p.sourceRowId);
  } else {
    // Use current selection, but only from the active animation instance
    const validPaths = state.selectionState.paths.filter((path) => {
      const parsed = parseMarkerPath(path);
      return parsed.instanceId === state.activeAnimationInstance;
    });

    if (validPaths.length === 0) {
      return; // Nothing to drag
    }

    // Parse paths to get marker IDs and source row IDs
    const parsedPaths = validPaths.map((path) => parseMarkerPath(path));
    idsToUse = parsedPaths.map((p) => p.markerId);
    sourceRowIds = parsedPaths.map((p) => p.sourceRowId);
  }

  // If no valid IDs to drag, exit
  if (idsToUse.length === 0) {
    return;
  }

  // Validate all markers are from the same animation instance
  let commonInstanceId: string | undefined;
  for (let i = 0; i < idsToUse.length; i++) {
    const marker = getMarkerById(state, idsToUse[i], sourceRowIds[i]);
    if (!marker) continue;

    const instanceId = getMarkerInstanceId(marker);
    if (!instanceId) continue;

    if (!commonInstanceId) {
      commonInstanceId = instanceId;
    } else if (instanceId !== commonInstanceId) {
      console.warn("Cannot drag markers from different animation instances");
      return;
    }
  }

  if (!commonInstanceId) {
    console.warn("Could not determine instance ID for drag operation");
    return;
  }

  const draggedKeypoints = new Map<string, DraggedKeypoint>();
  const startPositions = new Map<string, number>();

  // Look up fresh data for each marker ID
  idsToUse.forEach((markerId, idx) => {
    const sourceRowId = sourceRowIds[idx];
    const marker = getMarkerById(state, markerId, sourceRowId);

    if (marker) {
      // Process each point in the marker
      marker.points.forEach((point) => {
        // Store positions in normalized 0-1 space
        // marker.stamp is already in normalized space
        draggedKeypoints.set(point.id, {
          trackId: point.trackId,
          keypointId: point.id,
          originalStamp: marker.stamp, // This is in 0-1 normalized space
          currentOffset: 0,
        });
        startPositions.set(point.id, marker.stamp); // Also in 0-1 normalized space
      });
    }
  });

  // Only start drag if we have keypoints to drag
  if (draggedKeypoints.size === 0) {
    return;
  }

  // Set the drag state with normalized positions
  const dragState: DragState = {
    isDragging: true,
    draggedKeypoints,
    startPositions,
    deltaStamp: 0, // Delta will also be in normalized space
  };

  state.dragState = dragState;
}
