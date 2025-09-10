import type { AnimationData } from "../../store-types";

/**
 * Cancel the current drag operation without applying changes.
 * @param state - The animation state to modify
 */
export function cancelDrag(state: AnimationData): void {
  // Exit early if not currently dragging
  if (!state.dragState?.isDragging) {
    return;
  }

  // Simply clear drag state without applying any changes
  state.dragState = null;
}
