import type { AnimationData } from "../store-types";
import type { Keyframe } from "../types";

export function createAutoKeyframe(
  state: AnimationData,
  animationId: string,
): Keyframe {
  const id = crypto.randomUUID();
  const keyframe: Keyframe = {
    stamp: state.player.stamp,
    points: [],
    id,
  };
  // Insert the keyframe into the correct position based on stamp
  const index = state.animations[animationId].frameOrder.findIndex(
    (frameId: string) =>
      (state.animations[animationId].frames.get(frameId)?.stamp || -1) >
      keyframe.stamp,
  );
  // insert the frame at that index
  state.animations[animationId].frameOrder.splice(index, 0, id);
  state.animations[animationId].frames.set(id, keyframe);

  return keyframe;
}
