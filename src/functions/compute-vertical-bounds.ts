import { AnimatableValue, RawValue } from "@semio/utils";
import type { AnimationCache } from "../types";

/**
 * Creates a range from min to max .
 * Note, the timestamps are the raw, unadjusted (with respect to namespaces) timestamps.
 * @param trackCaches - The cached animation tracks
 * @param animatableValues - The animatable values
 * @returns - The min and max values
 */
export function computeVerticalBounds(
  trackCaches: AnimationCache,
  animatableValues: AnimatableValue[],
): [number, number] {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  // First, get a default min and max value from the animatables;
  animatableValues.forEach((animatable) => {
    if (animatable.type === "number") {
      const constraintMin = animatable.constraints.min ?? Number.POSITIVE_INFINITY;
      const constraintMax = animatable.constraints.max ?? Number.NEGATIVE_INFINITY;
      if (constraintMin < min) min = constraintMin;
      if (constraintMax > max) max = constraintMax;
    }
  });

  // Next, iterate over the track caches to find the min and max values.
  Object.values(trackCaches).forEach((trackCache) => {
    trackCache.forEach((point: { id: string; stamp: number; value: RawValue }) => {
      if (typeof point.value === "number") {
        if (point.value < min) min = point.value;
        if (point.value > max) max = point.value;
      }
    });
  });

  if (min > max) return [0, 1];

  return [min, max];
}
