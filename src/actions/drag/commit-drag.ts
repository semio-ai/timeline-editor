import type { RawValue } from "@semio/utils";
import type { AnimationData, DraggedKeypoint } from "../../store-types";
import type { Track } from "../../types";
import { computeFrames } from "../../functions";

/**
 * Commit the current drag operation, applying all changes.
 * @param state - The animation state to modify
 */
export function commitDrag(state: AnimationData): void {
  // Exit early if not currently dragging
  if (!state.dragState?.isDragging) {
    return;
  }

  // Store the IDs of all selected keypoints before updating
  const selectedKeypointIds = new Set<string>();
  state.selection.forEach((frame) => {
    frame.points.forEach((point) => {
      selectedKeypointIds.add(point.id);
    });
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

  // Recompute frames from updated tracks
  const newFrames = computeFrames(state.tracks);

  // Build new selection to maintain multi-selection after drag
  state.selection = newFrames.filter((frame) => {
    // Select this frame if it contains at least one previously selected point
    return frame.points.some((point) => selectedKeypointIds.has(point.id));
  });

  // Update reference marker if it was selected
  if (state.referenceMarker) {
    const referenceKeypointIds = state.referenceMarker.marker.points.map((p) => p.id);
    const wasReferenceSelected = referenceKeypointIds.some((id: string) =>
      selectedKeypointIds.has(id),
    );

    if (wasReferenceSelected) {
      // Find the new frame for the reference marker
      const newReferenceFrame = newFrames.find((frame) =>
        frame.points.some((point) => referenceKeypointIds.includes(point.id)),
      );

      if (newReferenceFrame) {
        state.referenceMarker.marker = newReferenceFrame;
      }
    }
  }

  // Clear drag state
  state.dragState = null;
}
