import type { AnimationData } from "../../store-types";

/**
 * Commit the current drag operation, applying all changes.
 * This uses the ID-based architecture to avoid stale data issues.
 *
 * @param state - The animation state to modify
 */
export function commitDrag(state: AnimationData): void {
  if (!state.dragState) {
    return;
  }

  /**
   * TODO(semio-agent): resolve selection and write deltas via applyKeypointDelta.
   */
  state.dragState = undefined;
}
