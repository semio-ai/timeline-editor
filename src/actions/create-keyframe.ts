import type { AnimationData } from "../store-types";
import type { Keyframe } from "../types";

export function createKeyframe(
  state: AnimationData,
  animationId: string,
  keyframe: Partial<Keyframe>,
): Keyframe {
  const id = crypto.randomUUID();
  const stamp = state.player.stamp;
  const completekeyframe: Keyframe = {
    stamp,
    id,
    points: [],
    ...keyframe,
  };

  // Insert the keyframe into the correct position based on time
  const index = state.animations[animationId].frameOrder.findIndex(
    (frameId) =>
      (state.animations[animationId].frames.get(frameId)?.stamp || -1) > stamp,
  );
  // insert the frame at that index
  state.animations[animationId].frameOrder.splice(index, 0, id);
  state.animations[animationId].frames.set(id, completekeyframe);

  return completekeyframe;
}
