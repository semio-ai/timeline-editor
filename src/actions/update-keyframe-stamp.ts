import type { AnimationData } from "../store-types";

export function updateKeyframeStamp(
  state: AnimationData,
  animationId: string,
  frameId: string,
  stamp: number,
) {
  const frame = state.animations[animationId].frames.get(frameId);
  if (frame) {
    frame.stamp = stamp;
    state.animations[animationId].frames.set(frameId, frame);
  }
}
