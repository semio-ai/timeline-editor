import {
  AnimatableVector3,
  AnimatableEuler,
  AnimatableColor,
  AnimatableValue,
  RawValue,
  RawVector3,
  RawEuler,
  RawColor,
  AnimatableVector2,
} from "@semio/utils";
import type { SourceRow, Track } from "../types";
import { COMPLEX_TYPES, TYPE_FIELDS } from "../constants";

/**
 * Creates a range from min to max .
 * Note, the timestamps are the raw, unadjusted (with respect to namespaces) timestamps.
 * @param tracks - A pre-filtered record of tracks
 * @param animatableValues - The animatable values
 * @param sources - an optional attribute to filter by
 * @returns - The min and max values
 */
export function computeVerticalBounds(
  tracks: Record<string, Track<RawValue>>,
  animatableValues: Record<string, AnimatableValue>,
  sources: SourceRow[],
): [number, number] {
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
      } else if (datum.attribute && COMPLEX_TYPES.has(animatable.type)) {
        const constraintMin = filteredMin(
          animatable as AnimatableVector3 | AnimatableVector2 | AnimatableEuler | AnimatableColor,
          datum.attribute,
        );
        const constraintMax = filteredMax(
          animatable as AnimatableVector3 | AnimatableVector2 | AnimatableEuler | AnimatableColor,
          datum.attribute,
        );
        if (constraintMin < min) min = constraintMin;
        if (constraintMax > max) max = constraintMax;
      }
    });
  });

  // Next, iterate over the track caches to find the min and max values.
  const data: number[] = sources.flatMap((source) =>
    source.data.flatMap(({ trackId, attribute }) => {
      const track = tracks[trackId];
      if (!track) return [0];
      const points = track.points;
      if (!points || points.length === 0) return [0];
      return points.map((point) => {
        if (typeof point.value === "number") return point.value;
        if (attribute && typeof point.value === "object")
          return point.value[attribute as ComplexField];
        return 0;
      });
    }),
  );

  min = min === Number.POSITIVE_INFINITY ? Math.min(...data) : min;
  max = max === Number.NEGATIVE_INFINITY ? Math.max(...data) : max;

  return [min, max];
}

/**
 * Computes the minimum value for a given attribute of an animatable object.
 *
 * @param animatable - The animatable object which can be of type `AnimatableVector3`, `AnimatableEuler`, or `AnimatableColor`.
 * @param attribute - The attribute for which the minimum value is to be computed.
 *                    It can be "x", "y", "z" for `AnimatableVector3` and `AnimatableEuler`,
 *                    "r", "g", "b" for `AnimatableColor` of type "rgb",
 *                    or "h", "s", "l" for `AnimatableColor` of type "hsl".
 * @returns The minimum value for the specified attribute. If the attribute is not found,
 *          it returns `Number.POSITIVE_INFINITY` for `AnimatableVector3` and `AnimatableEuler`,
 *          and `1` for `AnimatableColor`.
 */
function filteredMin(
  animatable: AnimatableVector3 | AnimatableVector2 | AnimatableEuler | AnimatableColor,
  attribute: string,
): number {
  let max = Number.POSITIVE_INFINITY;
  const index = TYPE_FIELDS[animatable.type]?.indexOf(attribute) ?? -1;
  if (animatable.type === "rgb" || animatable.type === "hsl") {
    max = 1;
  }
  if (index === -1) {
    return max;
  } else {
    return animatable.constraints.min?.[index] ?? max;
  }
}

/**
 * Computes the maximum constraint value for a given attribute of an animatable object.
 *
 * @param animatable - The animatable object which can be of type `AnimatableVector3`, `AnimatableEuler`, or `AnimatableColor`.
 * @param attribute - The attribute for which the maximum constraint value is to be computed.
 *                    It can be "x", "y", "z" for vector3/euler types, "r", "g", "b" for rgb type,
 *                    and "h", "s", "l" for hsl type.
 * @returns The maximum constraint value for the specified attribute, or a default value if the attribute is not found.
 */
function filteredMax(
  animatable: AnimatableVector3 | AnimatableVector2 | AnimatableEuler | AnimatableColor,
  attribute: string,
): number {
  let min = Number.NEGATIVE_INFINITY;
  const index = TYPE_FIELDS[animatable.type]?.indexOf(attribute) ?? -1;
  if (animatable.type === "rgb" || animatable.type === "hsl") {
    min = 0;
  }
  if (index === -1) {
    return min;
  } else {
    return animatable.constraints.max?.[index] ?? min;
  }
}

type ComplexRawValue = RawVector3 | RawEuler | RawColor;
type ComplexField = keyof ComplexRawValue;
