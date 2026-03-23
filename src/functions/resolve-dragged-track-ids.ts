import type { DragState, SelectionState } from "../types";

export function resolveDraggedTrackIds(
  dragState: DragState | undefined,
  selectionState: SelectionState,
): Set<string> | undefined {
  if (selectionState.instanceId !== dragState?.instanceId) {
    return undefined;
  }

  const draggedTrackIds = new Set<string>();

  if (dragState.trackSnapshots) {
    Object.keys(dragState.trackSnapshots).forEach((trackId) => {
      draggedTrackIds.add(trackId);
    });
  }

  if (draggedTrackIds.size === 0) {
    selectionState.keypoints.forEach((_ids, trackId) => {
      draggedTrackIds.add(trackId);
    });
  }

  if (dragState.anchor?.trackId) {
    draggedTrackIds.add(dragState.anchor.trackId);
  }

  if (dragState.handleAnchor?.trackId) {
    draggedTrackIds.add(dragState.handleAnchor.trackId);
  }

  return draggedTrackIds.size > 0 ? draggedTrackIds : undefined;
}
