import type { AnimationData } from "../../store-types";

/**
 * Cancel the current drag operation without applying changes.
 * @param state - The animation state to modify
 */
export function cancelDrag(state: AnimationData): void {
  if (!state.dragState) {
    return;
  }

  state.dragState = undefined;
}
