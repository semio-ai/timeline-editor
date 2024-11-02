import { AnimationData } from "../store-types";
import { StoredAnimation } from "../types";
import { migrateAnimation } from "../functions/migrate-animation";

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
  // console.log("Updated animations now include", state.animations);
}
