import { AnimationData } from "../store-types";
import { Animation } from "../types";

export function addAnimation(
  state: AnimationData,
  animationData: unknown,
) {
    if (animationData && typeof animationData === 'object') {

        const animationId = (animationData as { id?: string }).id ?? state.activeAnimation;
        const animation: Animation = {
          id: animationId,
          name: (animationData as { name: string }).name,
          duration: (animationData as { duration: number }).duration,
          tracks: (animationData as { tracks: any }).tracks,
          points: (animationData as { points: any }).points, 
          frames: (animationData as { frames: any }).frames, 
          groups: (animationData as { groups: any }).groups, 
          transitions: (animationData as { transitions: any }).transitions,
          frameOrder: ( animationData as { frameOrder: any}).frameOrder, 
          trackOrder: ( animationData as { trackOrder: any}).trackOrder, 
          instances: ( animationData as { instances: any}).instances
        };
        state.animations[animationId] = {
          ...animation,
        };
        if (animationId && !state.visualizedAnimations.includes(animationId)) {
          state.visualizedAnimations.push(animationId);
        }
        state.activeAnimation = animationId;
      }
      // console.log("Updated animations now include", state.animations);
}
