import { AnimatableValue, AnimatableGroupType, RawValue } from "@semio/utils";
import type { SourceRow, Track } from "../types";

/**
 * Infer a reasonable fallback range for a degenerate (min === max) domain using
 * animatable metadata: units, group type, or a generic window around the value.
 */
function inferFallbackRange(
  center: number,
  animatables: AnimatableValue[],
): [number, number] {
  for (const animatable of animatables) {
    if (animatable.type !== "number") continue;

    // Unit-based inference
    const units = animatable.pub?.units;
    if (units === "rad") {
      return [-Math.PI, Math.PI];
    }

    // Group-type inference
    const groupType = animatable.group?.type;
    if (groupType === AnimatableGroupType.Euler) {
      return [-Math.PI, Math.PI];
    }
    if (groupType === AnimatableGroupType.RGB) {
      return [0, 1];
    }
    if (groupType === AnimatableGroupType.HSL) {
      return [0, 1];
    }
  }

  // Generic fallback: ±1 window around the value (or [-1, 1] at zero)
  const halfSpan = Math.abs(center) > 0 ? Math.abs(center) : 1;
  return [center - halfSpan, center + halfSpan];
}

/**
 * Creates a range from min to max .
 * Note, the timestamps are the raw, unadjusted (with respect to namespaces) timestamps.
 * @param tracks - A pre-filtered record of tracks
 * @param animatableValues - The animatable values
 * @param sources - the source rows used to scan values
 * @returns - The min and max values
 */
export function computeVerticalBounds(
  tracks: Record<string, Track<RawValue>>,
  animatableValues: Record<string, AnimatableValue>,
  sources: SourceRow[],
): [number, number] {
  if (!sources || sources.length === 0) {
    return [-1, 1];
  }

  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  const rowAnimatables: AnimatableValue[] = [];

  // First, get a default min and max value from the animatables;
  sources.forEach((source) => {
    source.data.forEach((datum) => {
      const track = tracks[datum.trackId];
      if (!track) return;
      const animatable = animatableValues[track.animatableId];
      if (!animatable) return;
      rowAnimatables.push(animatable);
      // Compute the min and max based on the animatable constraints.
      if (animatable.type === "number") {
        const constraintMin = animatable.constraints.min ?? Number.POSITIVE_INFINITY;
        const constraintMax = animatable.constraints.max ?? Number.NEGATIVE_INFINITY;
        if (constraintMin < min) min = constraintMin;
        if (constraintMax > max) max = constraintMax;
      } else if (animatable.type === "boolean") {
        if (min > 0) min = 0;
        if (max < 1) max = 1;
      }
    });
  });

  // Next, iterate over the track caches to find the min and max values.
  const data: number[] = sources.flatMap((source) =>
    source.data.flatMap(({ trackId }) => {
      const track = tracks[trackId];
      if (!track) return [0];
      const points = track.points;
      if (!points || points.length === 0) return [0];
      return points.map((point) => {
        if (typeof point.value === "number") return point.value;
        if (typeof point.value === "boolean") return point.value ? 1 : 0;
        return 0;
      });
    }),
  );

  min = min === Number.POSITIVE_INFINITY ? Math.min(...data) : min;
  max = max === Number.NEGATIVE_INFINITY ? Math.max(...data) : max;

  // When the domain is degenerate (min === max), infer a reasonable range from
  // animatable metadata (units, group type) so that spline rendering and drag
  // interactions have a meaningful vertical scale from the first frame.
  if (Number.isFinite(min) && Number.isFinite(max) && min === max) {
    return inferFallbackRange(min, rowAnimatables);
  }

  return [min, max];
}
