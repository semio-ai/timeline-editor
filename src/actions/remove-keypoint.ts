import type { AnimationData } from "../store-types";
import { removeKeyframe } from "./remove-keyframe";

export function removeKeypoint(state: AnimationData, animationId: string, keypointId: string) {
  const point = state.animations[animationId].points.get(keypointId);
  if (!point) {
    return;
  }
  const parentFrame = state.animations[animationId].frames.get(point.frame);
  if (parentFrame) {
    parentFrame.points = parentFrame.points.filter((pointId) => pointId !== keypointId);
    if (parentFrame.points.length === 0) {
      removeKeyframe(state, animationId, parentFrame.id);
    } else {
      state.animations[animationId].frames.set(point.frame, parentFrame);
    }
  }
  const parentTrack = state.animations[animationId].tracks.get(point.track);
  if (parentTrack && "points" in parentTrack) {
    parentTrack.points = parentTrack.points.filter((pointId) => pointId !== keypointId);
    state.animations[animationId].tracks.set(point.track, parentTrack);
  }
  state.animations[animationId].points.delete(keypointId);
}
