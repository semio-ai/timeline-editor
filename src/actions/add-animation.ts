import { AnimationData } from "../store-types";
import { StoredAnimation } from "../types";
import { migrateAnimation } from "../functions/migrate-animation";

/**
 * Adds an animation to the state.
 *
 * This function takes the provided animation data, migrates it to the current format,
 * and updates the state with the new animation and its tracks. If the animation ID is
 * not provided, it uses the active animation ID from the state. The function also
 * ensures that the animation is added to the list of visualized animations and sets
 * it as the active animation.
 *
 * @param state - The current state of the animation data.
 * @param animationData - The data of the animation to be added. It should be an object
 *                        containing the animation details.
 */
export function addAnimation(state: AnimationData, animationData: unknown) {
  if (animationData && typeof animationData === "object") {
    const animationId = (animationData as { id?: string }).id ?? state.activeAnimation;
    const { animation, tracks } = migrateAnimation(animationData as StoredAnimation);

    state.animations[animationId] = {
      ...animation,
    };
    state.tracks = { ...state.tracks, ...tracks };
    if (animationId && !state.visualizedAnimations.includes(animationId)) {
      state.visualizedAnimations.push(animationId);
    }
    state.activeAnimation = animationId;
  }
}
