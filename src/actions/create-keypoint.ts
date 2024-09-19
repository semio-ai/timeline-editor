import { RawValue } from "@semio/utils";
import type { AnimationData } from "../store-types";
import { Keypoint } from "../types";
import { createKeyframe } from "./create-keyframe";

export function createKeypoint(
  state: AnimationData,
  animationId: string,
  trackId: string,
  point: Partial<Keypoint<RawValue>>,
): Keypoint<RawValue> {
  const id = crypto.randomUUID();
  const keyframeId =
    point.frame ?? state.selectedKeyframe ?? crypto.randomUUID();
  const frame =
    state.animations[animationId].frames.get(keyframeId) ??
    createKeyframe(state, animationId, { id: keyframeId });
  frame.points.push(id);
  state.animations[animationId].frames.set(frame.id, frame);
  const newPoint = {
    id,
    value: state.values.get(trackId) ?? 0,
    frame: frame.id,
    track: trackId,
    ...point,
  };

  state.animations[animationId].points.set(newPoint.id, newPoint);

  const track = state.animations[animationId].tracks.get(trackId);
  if (track && "points" in track) {
    track.points.push(newPoint.id);
    state.animations[animationId].tracks.set(trackId, track);
  }
  return newPoint;
}
