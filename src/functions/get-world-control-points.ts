import { RawValue, RawVector2 } from "@semio/utils";
import {
  Keypoint,
  StandardEaseInParameters,
  StandardEaseOutParameters,
  StandardTransitionType,
} from "../types";
import { rawValueMultiplyScalar, rawValueDiff, rawValueAdd } from "./raw-value-math";

interface ComplexPosition<T> {
  x: number;
  y: T;
}

/**
 * Calculates a pair of animation-space control points for a Bezier curve segment between two keypoints.
 * Note, this does not handle offsets/timescaling that can be introduced by the animation instance, which would
 * result in changes to the x values calculated here.
 *
 * This function i salso written to be generic over RawValue types, even though we will only be handling
 * number types for now, and complex RawValues are being phased out.
 *
 * This function does not do any clamping for computing the monotonic versions of control points.
 * That would need either a parallel function or a post-processing step on the results of this function.
 *
 * @param startStamp - The first stamp (in animation 0-1 space) of the pair of keypoints
 * @param endStamp - The second stamp (in animation 0-1 space) of the pair of keypoints
 * @param startValue - The value at the first keypoint
 * @param endValue - The value at the second keypoint
 * @param startTransitions - The transitions object from the first keypoint
 * @param endTransitions - The transitions object from the second keypoint
 * @returns
 */
export function getWorldControlPoints<T extends RawValue>(
  startStamp: number,
  endStamp: number,
  startValue: T,
  endValue: T,
  startTransitions: Keypoint<T>["transitions"],
  endTransitions: Keypoint<T>["transitions"],
): { start: ComplexPosition<T>; end: ComplexPosition<T> } {
  const defaultStartTransitionOut =
    startTransitions?.out && typeof startTransitions?.out !== "object"
      ? startTransitions.out
      : StandardTransitionType.Cubic;
  const defaultEndTransitionIn =
    endTransitions?.in && typeof endTransitions?.in !== "object"
      ? endTransitions.in
      : StandardTransitionType.Cubic;

  const isExplicitOut = startTransitions?.out && typeof startTransitions?.out === "object";
  const isExplicitIn = endTransitions?.in && typeof endTransitions?.in === "object";

  let startCP: { x: number; y: T };
  let endCP: { x: number; y: T };

  if (isExplicitOut) {
    startCP = {
      x: startStamp + (startTransitions!.out as RawVector2)!.x,
      y: rawValueAdd(startValue, (startTransitions!.out as RawVector2)!.y) as T,
    };
  } else {
    startCP = getWorldFromParametric(
      "start",
      defaultStartTransitionOut,
      startStamp,
      endStamp,
      startValue,
      endValue,
    );
  }

  if (isExplicitIn) {
    endCP = {
      x: endStamp + (endTransitions!.in as RawVector2)!.x,
      y: rawValueAdd(startValue, (endTransitions!.in as RawVector2)!.y) as T,
    };
  } else {
    endCP = getWorldFromParametric(
      "end",
      defaultEndTransitionIn,
      startStamp,
      endStamp,
      startValue,
      endValue,
    );
  }

  return {
    start: startCP,
    end: endCP,
  };
}

function getWorldFromParametric<T extends RawValue>(
  side: "start" | "end",
  easing: StandardTransitionType,
  startStamp: number,
  endStamp: number,
  startValue: T,
  endValue: T,
): ComplexPosition<T> {
  const easingParams =
    side === "start" ? StandardEaseOutParameters[easing] : StandardEaseInParameters[easing];
  const xParam = easingParams.x;
  const yParam = easingParams.y;

  const x = xParam * (endStamp - startStamp) + startStamp;
  const valueDiff = rawValueDiff(endValue, startValue);
  const yValueDiff = rawValueMultiplyScalar(valueDiff, yParam);
  const y = rawValueAdd(startValue, yValueDiff);

  return { x, y: y as T };
}
