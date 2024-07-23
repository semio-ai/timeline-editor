import { RawValue } from "@semio/utils";
import { AnimationData } from "../store-types";
import { Keyframe, Keypoint } from "../types";
import { updateKeypointValue } from "./update-keypoint-value";
import { createKeypoint } from "./create-keypoint";
import { createKeyframe } from "./create-keyframe";
import { createTrack } from "./create-track";

export function updateAnimationKeypoint(
  state: AnimationData,
  animationId: string,
  keyframeOrTime: string | number,
  trackId: string,
  value: RawValue,
): Keypoint<RawValue> {
  let keyframe: Keyframe | undefined;
  const animation = state.animations[animationId];

  if (typeof keyframeOrTime === "string") {
    keyframe = animation.frames.get(keyframeOrTime);
  } else {
    const existingKeyframeId = animation.frameOrder.find(
      (frame) => animation.frames.get(frame)?.stamp === keyframeOrTime,
    );
    keyframe = existingKeyframeId
      ? animation.frames.get(existingKeyframeId)
      : undefined;
  }

  const timestamp = keyframe?.stamp || state.player.stamp;

  if (!keyframe) {
    keyframe = createKeyframe(state, animationId, { stamp: timestamp });
  }

  let track = animation.tracks.get(trackId);
  if (!track) {
    track = createTrack(state, animationId, { id: trackId });
  }

  if (!keyframe || !track) {
    throw new Error("Could not create keyframe or track");
  }

  let point = [...state.animations[animationId].points.values()].find(
    (p) => p.frame === keyframe?.id && p.track === track?.id,
  );

  if (!point) {
    point = createKeypoint(state, animationId, trackId, {
      value,
      track: trackId,
      frame: keyframe.id,
    });
    return point;
  } else {
    return updateKeypointValue(state, animationId, point.id, value)!;
  }
}
