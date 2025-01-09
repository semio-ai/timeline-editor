import { omit } from "lodash";
import { DEFAULT_ANIMATION_ID } from "../constants";
import { AnimationData } from "../store-types";
import { addAnimation } from "./add-animation";
import { createDefaultAnimation } from "./create-default-animation";

/**
 * Removes an animation from the state by its ID.
 *
 * If the animation to be removed is the active animation,
 * it updates the active animation to the next available one
 * in the visualized animations list or the animations list.
 * If no animations are left, it creates and adds a default animation.
 *
 * @param state - The current state of animations.
 * @param animationId - The ID of the animation to be removed.
 */
export function removeAnimation(state: AnimationData, animationId: string) {
  if (animationId in state.animations) {
    console.log("removeAnimation -> Removing animation", animationId);
    const { [animationId]: animation, ...newAnimations } = state.animations;
    state.animations = newAnimations;
    // Remove the tracks for that animation
    animation.tracks.forEach((trackId) => {
      console.log("Removing track", trackId);
      state.tracks = omit(state.tracks, [trackId]);
    });
    state.visualizedAnimations = state.visualizedAnimations.filter((id) => id !== animationId);
    if (state.activeAnimation === animationId) {
      if (state.visualizedAnimations.length > 0) {
        state.activeAnimation = state.visualizedAnimations[0];
      } else if (Object.keys(state.animations).length > 0) {
        state.activeAnimation = Object.keys(state.animations)[0];
      } else if (animationId !== DEFAULT_ANIMATION_ID) {
        const newAnimation = createDefaultAnimation();
        addAnimation(state, newAnimation);
      }
    }
  }
}
