import type { RawValue } from "@semio/utils";
import type { AnimationData } from "../../store-types";
import type { Track, DraggedKeypoint } from "../../types";
import { getMarkerById } from "../../functions/marker-utils";
import { parseMarkerPath } from "../../functions/selection-state-manager";

/**
 * Commit the current drag operation, applying all changes.
 * This uses the ID-based architecture to avoid stale data issues.
 *
 * @param state - The animation state to modify
 */
export function commitDrag(state: AnimationData): void {
  // Exit early if not currently dragging
  if (!state.dragState?.isDragging) {
    return;
  }

  // Store the IDs of all selected keypoints before updating
  const selectedKeypointIds = new Set<string>();

  // Get fresh marker data for each selected path
  state.selectionState.paths.forEach((path) => {
    const { sourceRowId, markerId } = parseMarkerPath(path);
    const marker = getMarkerById(state, markerId, sourceRowId);
    if (marker) {
      marker.points.forEach((point) => {
        selectedKeypointIds.add(point.id);
      });
    }
  });

  // Apply drag offsets to all dragged keypoints
  state.dragState.draggedKeypoints.forEach((dragInfo: DraggedKeypoint) => {
    const track = state.tracks[dragInfo.trackId];
    if (track) {
      const point = track.points.find((p) => p.id === dragInfo.keypointId);
      if (point) {
        point.stamp = dragInfo.originalStamp + dragInfo.currentOffset;
      }
    }
  });

  // Sort points after updates to maintain chronological order
  (Object.values(state.tracks) as Track<RawValue>[]).forEach((track) => {
    track.points.sort((a, b) => a.stamp - b.stamp);
  });

  // Clear drag state
  state.dragState = null;

  // The selection will be automatically updated through the computed row data subscription
  // which will regenerate the virtual frames with the new positions
  // Since we're using ID-based selection, the selection entries remain valid
  // and will reference the updated marker positions
}
