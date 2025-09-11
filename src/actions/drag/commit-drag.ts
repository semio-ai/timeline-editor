import type { RawValue } from "@semio/utils";
import type { AnimationData } from "../../store-types";
import type { Track, InstancedFrameInfo, DraggedKeypoint } from "../../types";
import { computeFrames } from "../../functions";

/**
 * Commit the current drag operation, applying all changes.
 *
 * KNOWN ISSUE: After this commit, DataPoint components will have stale props
 * The components retain their original data.stamp values while the actual keypoints
 * have moved. This causes selection issues, particularly for the last selected marker
 * in a multi-selection drag operation.
 *
 * This architectural issue will be resolved in Phase 2+ refactoring when components
 * subscribe directly to computed store state rather than receiving props.
 * See: docs/dragging-architecture-proposal.md and docs/known-issues.md
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
  // We need to be more careful about rebuilding the selection to ensure
  // that frames are properly matched after drag operations
  //
  // NOTE: While the selection is correctly updated here in the store,
  // DataPoint components in the UI still hold stale props with old stamp values.
  // This causes the "last selected marker can't be reselected" bug.
  // The store state is correct, but the component layer has stale data.
  const newSelection: InstancedFrameInfo[] = [];

  // Create a map of point IDs to their new frames for efficient lookup
  const pointIdToFrame = new Map<string, InstancedFrameInfo>();
  newFrames.forEach((frame) => {
    frame.points.forEach((point) => {
      pointIdToFrame.set(point.id, frame);
    });
  });

  // For each previously selected point, find its new frame
  const addedFrames = new Set<InstancedFrameInfo>();
  selectedKeypointIds.forEach((pointId) => {
    const frame = pointIdToFrame.get(pointId);
    if (frame && !addedFrames.has(frame)) {
      newSelection.push(frame);
      addedFrames.add(frame);
    }
  });

  // Sort selection by stamp to maintain order
  state.selection = newSelection.sort((a, b) => a.stamp - b.stamp);

  // Update reference marker if it was selected
  if (state.referenceMarker) {
    const referenceKeypointIds = state.referenceMarker.marker.points.map((p) => p.id);
    const wasReferenceSelected = referenceKeypointIds.some((id: string) =>
      selectedKeypointIds.has(id),
    );

    if (wasReferenceSelected) {
      // Find the new frame for the reference marker
      // Use the first reference point ID to find the frame more reliably
      const firstReferencePointId = referenceKeypointIds[0];
      const newReferenceFrame = pointIdToFrame.get(firstReferencePointId);

      if (newReferenceFrame) {
        state.referenceMarker.marker = newReferenceFrame;
      }
    }
  }

  // Clear drag state
  state.dragState = null;
}
