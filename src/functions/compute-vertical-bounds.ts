import { AnimatableValue, RawValue } from "@semio/utils";
import type { SourceRow, Track } from "../types";

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
  // First, get a default min and max value from the animatables;
  sources.forEach((source) => {
    source.data.forEach((datum) => {
      const track = tracks[datum.trackId];
      if (!track) return;
      const animatable = animatableValues[track.animatableId];
      if (!animatable) return;
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

  return [min, max];
}
