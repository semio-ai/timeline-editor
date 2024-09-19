import { AnimationData } from "../store-types";
import { addAnimation } from "./add-animation";
import { createDefaultAnimation } from "./create-default-animation";

export function removeAnimation(state: AnimationData, animationId: string) {
  if (animationId in state.animations) {
    const { [animationId]: _, ...newAnimations } = state.animations;
    state.animations = newAnimations;
    state.visualizedAnimations = state.visualizedAnimations.filter(
      (id) => id !== animationId,
    );
    if (state.activeAnimation === animationId) {
      if (state.visualizedAnimations.length > 0) {
        state.activeAnimation = state.visualizedAnimations[0];
      } else if (Object.keys(state.animations).length > 0) {
        state.activeAnimation = Object.keys(state.animations)[0];
      } else if (animationId !== "Unsaved Default Animation") {
        // console.log("Creating new default animation", Object.keys(state.animations));
        const newAnimation = createDefaultAnimation();
        addAnimation(state, newAnimation);
      } else {
        // console.log("No animations to visualize");
      }
    }
  } else {
    // console.log("Animation not found", animationId);
  }
  // console.log("Removal of animations completed", Object.keys(state.animations));
}
