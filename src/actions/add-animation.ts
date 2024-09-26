import { type RawValue } from "@semio/utils";
import { AnimationData } from "../store-types";
import { Animation, InstanceInfo, Keyframe, Keypoint, Track, TrackGroup, Transition } from "../types";

export function addAnimation(state: AnimationData, animationData: unknown) {
  if (animationData && typeof animationData === "object") {
    const animationId =
      (animationData as { id?: string }).id ?? state.activeAnimation;
    const animation: Animation = {
      id: animationId,
      name: (animationData as { name: string }).name,
      duration: (animationData as { duration: number }).duration,
      tracks: (animationData as { tracks: Map<string, Track> }).tracks,
      points: (animationData as { points: Map<string, Keypoint<RawValue>> }).points,
      frames: (animationData as { frames: Map<string, Keyframe> }).frames,
      groups: (animationData as { groups: Map<string, TrackGroup> }).groups,
      transitions: (animationData as { transitions: Map<string, Transition> }).transitions,
      frameOrder: (animationData as { frameOrder: string[] }).frameOrder,
      trackOrder: (animationData as { trackOrder: string[] }).trackOrder,
      instances: (animationData as { instances: Record<string, InstanceInfo> }).instances,
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
