import type { AnimationData } from "../store-types";
import { Keypoint } from "../types";

export function removeTrack(
  state: AnimationData,
  animationId: string,
  trackId: string,
) {
  const originalPoints = Object.values(state.animations[animationId].points);
  originalPoints.forEach((originalPoint: Keypoint<number | string>) => {
    if (originalPoint.track === trackId) {
      const parentFrame = state.animations[animationId].frames.get(
        originalPoint.frame,
      );
      if (parentFrame) {
        parentFrame.points = parentFrame.points.filter(
          (pointId) => pointId !== originalPoint.id,
        );
        state.animations[animationId].frames.set(
          originalPoint.frame,
          parentFrame,
        );
      }
      state.animations[animationId].points.delete(originalPoint.id);
    }
  });
}
