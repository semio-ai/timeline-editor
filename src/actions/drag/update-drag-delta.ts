import { closestFrame } from "@semio/utils";
import type { AnimationData } from "../../store-types";
import type { DraggedKeypoint } from "../../types";

/**
 * Update the drag delta during a drag operation.
 * All positions and deltas are in normalized 0-1 space.
 *
 * @param state - The animation state to modify
 * @param deltaStamp - The position offset in normalized 0-1 space
 * @param snapToFrames - Whether to snap to frame boundaries
 */
export function updateDragDelta(
  state: AnimationData,
  deltaStamp: number,
  snapToFrames: boolean,
): void {
  // Exit early if not currently dragging
  if (!state.dragState?.isDragging) {
    return;
  }

  // Update the overall delta (in normalized space)
  state.dragState.deltaStamp = deltaStamp;

  // Get frame count for snapping
  const duration = state.duration || 10000; // Default 10 seconds
  const frameCount = Math.floor(state.framerate * (duration / 1000));

  // Update each dragged keypoint's offset
  state.dragState.draggedKeypoints.forEach((dragInfo: DraggedKeypoint) => {
    if (snapToFrames) {
      // Calculate the new position in normalized space
      const newPosition = dragInfo.originalStamp + deltaStamp;

      // Clamp to valid range [0, 1]
      const clampedPosition = Math.max(0, Math.min(1, newPosition));

      // Snap to closest frame using the utility function
      const snappedPosition = closestFrame(clampedPosition, frameCount);

      // Calculate the snapped offset from original position
      dragInfo.currentOffset = snappedPosition - dragInfo.originalStamp;
    } else {
      // Direct offset without snapping
      dragInfo.currentOffset = deltaStamp;
    }
  });
}
