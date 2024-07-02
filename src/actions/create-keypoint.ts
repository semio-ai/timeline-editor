import type { AnimationData } from "../store-types";
import { Keypoint } from "../types";
import { createKeyframe } from "./create-keyframe";

export function createKeypoint(
  state: AnimationData,
  animationId: string,
  trackId: string,
  point: Partial<Keypoint<number | string>>,
) {
  const id = crypto.randomUUID();
  const keyframeId =
    point.frame ?? state.selectedKeyframe ?? crypto.randomUUID();
  const frame =
    state.animations[animationId].frames.get(keyframeId) ??
    createKeyframe(state, animationId, { id: keyframeId });
  frame.points.push(id);
  state.animations[animationId].frames.set(frame.id, frame);

  state.animations[animationId].points.set(id, {
    value: 0,
    frame: frame.id,
    track: trackId,
    ...point,
    id,
  });

  const track = state.animations[animationId].tracks.get(trackId);
  if (track && "points" in track) {
    track.points.push(id);
    state.animations[animationId].tracks.set(trackId, track);
  }
}
