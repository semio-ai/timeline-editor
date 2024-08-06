import { AnimationData } from "../store-types";

export function addAnimation(
  state: AnimationData,
  animationData: unknown,
) {
    if (animationData && typeof animationData === 'object') {

        const animationId = (animationData as { id?: string }).id ?? state.activeAnimation;
        state.animations[animationId] = {
          ...state.animations[state.activeAnimation],
          ...animationData,
        };
        if (animationId && !state.visualizedAnimations.includes(animationId)) {
          state.visualizedAnimations.push(animationId);
        }
      }
      // console.log("Updated animations now include", state.animations);
}
