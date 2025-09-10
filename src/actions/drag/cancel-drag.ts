import type { AnimationStoreGetter, AnimationStoreSetter } from "../../store-types";

/**
 * Cancel the current drag operation without applying changes.
 * @param get - The store getter function
 * @param set - The store setter function
 */
export function cancelDrag(
  get: AnimationStoreGetter,
  set: AnimationStoreSetter
): void {
  const state = get();

  // Exit early if not currently dragging
  if (!state.dragState?.isDragging) {
    return;
  }

  // Simply clear drag state without applying any changes
  set({ dragState: null });
}
