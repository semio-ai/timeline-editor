import type { AnimationData } from "../store-types";
import type { Track } from "../types";

export function removeKeyframe(
  state: AnimationData,
  animationId: string,
  keyframeId: string,
) {
  const frame = state.animations[animationId].frames.get(keyframeId);
  const deletedPoints: string[] = [];
  frame?.points.forEach((pointId: string) => {
    state.animations[animationId].points.delete(pointId);
    deletedPoints.push(pointId);
  });
  // Remove the deleted points from the tracks
  (Object.values(state.animations[animationId].tracks) as Track[]).forEach(
    (track: Track) => {
      if ("points" in track) {
        state.animations[animationId].tracks.set((track as Track).id, {
          ...track,
          points: (track as Track).points.filter(
            (pointId) => !deletedPoints.includes(pointId),
          ),
        } as Track);
      }
    },
  );
  // Remove the keyframe id from the ordered set
  state.animations[animationId].frameOrder = state.animations[
    animationId
  ].frameOrder.filter((frameId: string) => frameId !== keyframeId);
  // Remove the keyframe from the animation
  state.animations[animationId].frames.delete(keyframeId);
}
