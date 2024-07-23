import { RawValue } from "@semio/utils";
import type { AnimationData } from "../store-types";
import { Keypoint } from "../types";

export function updateKeypointValue(
  state: AnimationData,
  animationId: string,
  keypointId: string,
  value: RawValue,
): Keypoint<RawValue> | undefined {
  const point = state.animations[animationId].points.get(keypointId);

  if (point) {
    point.value = value;
    state.animations[animationId].points.set(keypointId, point);
  }

  return point;
}
