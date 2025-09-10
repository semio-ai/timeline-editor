import type { RawValue } from "@semio/utils";
import type { Keypoint } from "../../types";
import type { AnimationStoreGetter, AnimationStoreSetter } from "../../store-types";

/**
 * Commit the current drag operation, applying all changes.
 * @param get - The store getter function
 * @param set - The store setter function
 */
export function commitDrag(get: AnimationStoreGetter, set: AnimationStoreSetter): void {
  const state = get();

  // Exit early if not currently dragging
  if (!state.dragState?.isDragging) {
    return;
  }

  // Prepare batch updates for all dragged keypoints
  const updates: { trackId: string; keypoint: Partial<Keypoint<RawValue>> }[] = [];

  state.dragState.draggedKeypoints.forEach((dragInfo) => {
    updates.push({
      trackId: dragInfo.trackId,
      keypoint: {
        id: dragInfo.keypointId,
        stamp: dragInfo.originalStamp + dragInfo.currentOffset,
      },
    });
  });

  // Apply all updates in a single batch operation
  if (updates.length > 0) {
    state.updateKeypoints(updates, true); // Allow merging on commit
  }

  // Clear drag state
  set({ dragState: null });
}
