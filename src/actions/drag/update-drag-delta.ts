import { produce } from "immer";
import { closestFrame } from "@semio/utils";
import type {
  AnimationStoreGetter,
  AnimationStoreSetter,
  DraggedKeypoint,
} from "../../store-types";

/**
 * Update the drag delta during a drag operation.
 * All positions and deltas are in normalized 0-1 space.
 *
 * @param get - The store getter function
 * @param set - The store setter function
 * @param deltaStamp - The position offset in normalized 0-1 space
 * @param snapToFrames - Whether to snap to frame boundaries
 */
export function updateDragDelta(
  get: AnimationStoreGetter,
  set: AnimationStoreSetter,
  deltaStamp: number,
  snapToFrames: boolean,
): void {
  const state = get();

  // Exit early if not currently dragging
  if (!state.dragState?.isDragging) {
    return;
  }

  set(
    produce((draft) => {
      if (!draft.dragState) return;

      // Update the overall delta (in normalized space)
      draft.dragState.deltaStamp = deltaStamp;

      // Get frame count for snapping
      const duration = state.duration || 10000; // Default 10 seconds
      const frameCount = Math.floor(state.framerate * (duration / 1000));

      // Update each dragged keypoint's offset
      draft.dragState.draggedKeypoints.forEach((dragInfo: DraggedKeypoint) => {
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
    }),
  );
}
