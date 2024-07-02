import type { AnimationData } from "../store-types";

export function updateKeypointValue(
  state: AnimationData,
  animationId: string,
  keypointId: string,
  value: number | string,
) {
  const point = state.animations[animationId].points.get(keypointId);

  if (point) {
    point.value = value;
    state.animations[animationId].points.set(keypointId, point);
  }
}
