import { AnimatableValue, AnimatableGroupType, RawValue, unitDisplay } from "@semio/utils";
import type { SourceRow, Track } from "../types";

/**
 * Ensure the returned range contains the center value. Unit/group-based
 * inference can produce ranges that don't include the actual data value
 * (e.g., value 5.0 with units="rad" would infer [-π, π]). When this
 * range is used for drag clamping via boundsForRow, values outside the
 * inferred range would be silently clamped, preventing updates.
 */
function ensureContains(min: number, max: number, center: number): [number, number] {
  return [Math.min(min, center), Math.max(max, center)];
}

/**
 * Infer a reasonable fallback range for a degenerate (min === max) domain using
 * animatable metadata: units, group type, or a generic window around the value.
 * The returned range is guaranteed to contain the center value.
 */
function inferFallbackRange(
  center: number,
  animatables: AnimatableValue[],
): [number, number] {
  for (const animatable of animatables) {
    if (animatable.type !== "number") continue;

    // Unit-based inference, in stored units: the graph plots radians and
    // fractions, not the degrees and percentages a field shows.
    const unit = unitDisplay(animatable.pub?.units).code;
    if (unit === "rad") {
      return ensureContains(-Math.PI, Math.PI, center);
    }
    if (unit === "%") {
      return ensureContains(0, 1, center);
    }

    // Group-type inference
    const groupType = animatable.group?.type;
    if (groupType === AnimatableGroupType.Euler) {
      return ensureContains(-Math.PI, Math.PI, center);
    }
    if (groupType === AnimatableGroupType.RGB) {
      return ensureContains(0, 1, center);
    }
    if (groupType === AnimatableGroupType.HSL) {
      return ensureContains(0, 1, center);
    }
  }

  // Generic fallback: symmetric window scaled to the absolute value (or [-1, 1] at zero)
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
  const seenAnimatableIds = new Set<string>();
  const rowAnimatables: AnimatableValue[] = [];

  // First, get a default min and max value from the animatables;
  sources.forEach((source) => {
    source.data.forEach((datum) => {
      const track = tracks[datum.trackId];
      if (!track) return;
      const animatable = animatableValues[track.animatableId];
      if (!animatable) return;
      if (!seenAnimatableIds.has(animatable.id)) {
        seenAnimatableIds.add(animatable.id);
        rowAnimatables.push(animatable);
      }
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
