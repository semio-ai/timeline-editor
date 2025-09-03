import {
  AnimatableVector3,
  AnimatableEuler,
  AnimatableColor,
  AnimatableValue,
  RawValue,
  RawVector3,
  RawEuler,
  RawColor,
} from "@semio/utils";
import type { Source, Track } from "../types";

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
  sources: Source[],
): [number, number] {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  // First, get a default min and max value from the animatables;
  sources.forEach((source) => {
    const track = tracks[source.trackId];
    if (!track) return;
    const animatable = animatableValues[track.animatableId];
    if (!animatable) return;
    const attribute = source.attribute;

    // Compute the min and max based on the animatable constraints.
    if (animatable.type === "number") {
      const constraintMin = animatable.constraints.min ?? Number.POSITIVE_INFINITY;
      const constraintMax = animatable.constraints.max ?? Number.NEGATIVE_INFINITY;
      if (constraintMin < min) min = constraintMin;
      if (constraintMax > max) max = constraintMax;
    } else if (attribute && FilterableTypes.includes(animatable.type)) {
      const constraintMin = filteredMin(
        animatable as AnimatableVector3 | AnimatableEuler | AnimatableColor,
        attribute,
      );
      const constraintMax = filteredMax(
        animatable as AnimatableVector3 | AnimatableEuler | AnimatableColor,
        attribute,
      );
      if (constraintMin < min) min = constraintMin;
      if (constraintMax > max) max = constraintMax;
    }
  });

  // Next, iterate over the track caches to find the min and max values.
  const data = sources.flatMap((source) =>
    tracks[source.trackId].points.flatMap((point) => {
      if (typeof point.value === "number") return point.value;
      if (source.attribute && typeof point.value === "object")
        return point.value[source.attribute as ComplexField];
      return 0;
    }),
  );

  min = min === Number.POSITIVE_INFINITY ? Math.min(...data) : min;
  max = max === Number.NEGATIVE_INFINITY ? Math.max(...data) : max;

  return [min, max];
}

const FilterableTypes = ["vector3", "rgb", "hsl", "euler"];

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
  animatable: AnimatableVector3 | AnimatableEuler | AnimatableColor,
  attribute: string,
): number {
  let index = -1;
  let max = Number.POSITIVE_INFINITY;
  if (animatable.type === "vector3" || animatable.type === "euler") {
    index = ["x", "y", "z"].indexOf(attribute);
  } else if (animatable.type === "rgb") {
    index = ["r", "g", "b"].indexOf(attribute);
    max = 1;
  } else if (animatable.type === "hsl") {
    index = ["h", "s", "l"].indexOf(attribute);
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
  animatable: AnimatableVector3 | AnimatableEuler | AnimatableColor,
  attribute: string,
): number {
  let index = -1;
  let min = Number.NEGATIVE_INFINITY;
  if (animatable.type === "vector3") {
    index = ["x", "y", "z"].indexOf(attribute);
  } else if (animatable.type === "euler") {
    index = ["r", "p", "y"].indexOf(attribute);
  } else if (animatable.type === "rgb") {
    index = ["r", "g", "b"].indexOf(attribute);
    min = 0;
  } else if (animatable.type === "hsl") {
    index = ["h", "s", "l"].indexOf(attribute);
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
