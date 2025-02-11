import { AnimationData } from "../store-types";

/**
 * Updates the color setting of a specific control in the animation state.
 *
 * @param state - The current animation state containing controls.
 * @param trackId - The unique identifier of the control to update.
 * @param color - The new color to set for the control.
 */
export function updateControlColor(state: AnimationData, trackId: string, color: string) {
  if (state.tracks[trackId]) {
    if (!state.tracks[trackId].settings) {
      state.tracks[trackId].settings = {};
    }
    state.tracks[trackId].settings.color = color;
    const animatable = state.tracks[trackId].animatableId;
    if (animatable && state.animatables[animatable]?.pub) {
      state.animatables[animatable].pub.color = color;
    }
  }
}
