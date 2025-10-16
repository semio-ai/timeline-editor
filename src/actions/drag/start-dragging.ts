import type { DraggedKeypoint, DragState } from "../../types";
import type { AnimationData } from "../../store-types";
import { getMarkerById } from "../../functions/marker-utils";
import {
  extractKeypointsFromFrame,
  hasAllKeypoints,
  createEmptySelectionState,
} from "../../functions/selection-state-manager";

/**
 * Start a drag operation with the current selection or provided marker IDs.
 * All positions are stored in normalized 0-1 space.
 *
 * @param state - The animation state to modify
 * @param markerIds - Optional array of marker IDs to drag, defaults to current selection
 */
export function startDragging(state: AnimationData, markerIds?: string[]): void {
  const selection = state.selectionState ?? createEmptySelectionState();
  if (!selection.instanceId) {
    return;
  }

  const markers: { id: string; rowId: string }[] = [];

  for (const [rowId, rowData] of Object.entries(state.computedRowData)) {
    for (const frame of rowData.virtualFrames ?? []) {
      const addresses = extractKeypointsFromFrame(frame, selection.instanceId);
      if (addresses.length === 0) continue;
      if (!hasAllKeypoints(selection, addresses)) continue;

      markers.push({ id: frame.id, rowId });
    }
  }

  let filteredMarkers = markers;
  if (markerIds && markerIds.length > 0) {
    const markerSet = new Set(markerIds);
    filteredMarkers = markers.filter((marker) => markerSet.has(marker.id));
  }

  if (filteredMarkers.length === 0) {
    return;
  }

  const commonInstanceId = selection.instanceId;

  const draggedKeypoints = new Map<string, DraggedKeypoint>();
  const startPositions = new Map<string, number>();

  // Look up fresh data for each marker ID
  filteredMarkers.forEach(({ id, rowId }) => {
    const marker = getMarkerById(state, id, rowId);
    if (!marker) return;

    marker.points.forEach((point) => {
      if (point.instanceId !== commonInstanceId) return;
      const trackSelection = selection.keypoints.get(point.trackId);
      if (!trackSelection?.has(point.id)) return;

      draggedKeypoints.set(point.id, {
        trackId: point.trackId,
        keypointId: point.id,
        originalStamp: marker.stamp,
        currentOffset: 0,
      });
      startPositions.set(point.id, marker.stamp);
    });
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
