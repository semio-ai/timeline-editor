import type { AnimationData } from "../store-types";
import type { Track } from "../types";

export function removeKeyframe(
  state: AnimationData,
  animationId: string,
  keyframeId: string,
) {
  console.log("in remove keyframe", animationId, state.animations);
  const frame = state.animations[animationId].frames.get(keyframeId);
  const deletedPoints: string[] = [];
  frame?.points.forEach((pointId: string) => {
    const trackId = state.animations[animationId].points.get(pointId)?.track;
    const track = state.animations[animationId].tracks.get(trackId || "");
    if (track) {
      // Remove the deleted points from the track
      track.points = track.points.filter((id) => id !== pointId);
      state.animations[animationId].tracks.set(track.id, track);
    }
    state.animations[animationId].points.delete(pointId);
    deletedPoints.push(pointId);
  });
  // Remove the keyframe id from the ordered set
  state.animations[animationId].frameOrder = state.animations[
    animationId
  ].frameOrder.filter((frameId: string) => frameId !== keyframeId);
  // Remove the keyframe from the animation
  state.animations[animationId].frames.delete(keyframeId);
}
