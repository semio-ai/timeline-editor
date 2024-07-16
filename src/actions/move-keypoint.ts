import { type RawValue } from "@semio/utils";
import type { AnimationData } from "../store-types";
import type { Keypoint } from "../types";

export function moveKeypoint(
  state: AnimationData,
  animationId: string,
  keypointId: string,
  keyframeOrTime: string | number,
  trackId: string,
) {
  const point = state.animations[animationId].points.get(keypointId);
  if (!point) {
    return;
  }
  const draftPoint: Keypoint<RawValue> = { ...point };
  if (typeof keyframeOrTime === "string") {
    // Remove the point from the old frame and add it to the new frame
    const oldFrame = state.animations[animationId].frames.get(point.frame);
    if (oldFrame) {
      oldFrame.points = oldFrame.points.filter(
        (pointId) => pointId !== keypointId,
      );
      state.animations[animationId].frames.set(point.frame, oldFrame);
    }
    const newFrame = state.animations[animationId].frames.get(keyframeOrTime);
    if (newFrame) {
      newFrame.points.push(keypointId);
      state.animations[animationId].frames.set(keyframeOrTime, newFrame);
    }
    draftPoint.frame = keyframeOrTime;
  } else {
    // Create a new keyframe at that time
    const newFrameId = crypto.randomUUID();
    state.animations[animationId].frames.set(newFrameId, {
      stamp: keyframeOrTime,
      points: [keypointId],
      id: newFrameId,
    });
    draftPoint.frame = newFrameId;
  }
  if (point.track !== trackId) {
    // Remove the point from the old track and add it to the new track
    const oldTrack = state.animations[animationId].tracks.get(point.track);
    if (oldTrack && "points" in oldTrack) {
      oldTrack.points = oldTrack.points.filter(
        (pointId) => pointId !== keypointId,
      );
      state.animations[animationId].tracks.set(point.track, oldTrack);
    }
    const newTrack = state.animations[animationId].tracks.get(trackId);
    if (newTrack && "points" in newTrack) {
      newTrack.points.push(keypointId);
      state.animations[animationId].tracks.set(trackId, newTrack);
    }
    draftPoint.track = trackId;
  }
  state.animations[animationId].points.set(keypointId, draftPoint);
}
