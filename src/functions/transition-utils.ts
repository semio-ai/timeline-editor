import type { RawVector2, RawValue } from "@semio/utils";
import type { Keypoint, TransitionWorldHandle } from "../types";

export function normalizeVector(
  cp: TransitionWorldHandle,
  anchor: Keypoint<RawValue>,
  neighbor: Keypoint<RawValue>,
  fallback: RawVector2,
): RawVector2 {
  const span = neighbor.stamp - anchor.stamp;
  const valueDelta = neighborValue(neighbor.value, anchor.value);
  const x = span === 0 ? fallback.x : (anchor.stamp + cp.deltaStamp - anchor.stamp) / span;
  const y = valueDelta === 0 ? fallback.y : cp.deltaValue / valueDelta;
  return { x, y };
}

const neighborValue = (neighborVal: RawValue, anchorVal: RawValue): number => {
  if (typeof neighborVal === "number" && typeof anchorVal === "number") {
    return neighborVal - anchorVal;
  }
  return 0;
};
