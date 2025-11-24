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
  const startDelta = resolveTransitionDelta(
    "out",
    startStamp,
    endStamp,
    startValue,
    endValue,
    startTransitions?.out,
  );
  const endDelta = resolveTransitionDelta(
    "in",
    startStamp,
    endStamp,
    startValue,
    endValue,
    endTransitions?.in,
  );

  const startCP = {
    x: startStamp + startDelta.x,
    y: rawValueAdd(startValue, startDelta.y) as T,
  };

  const endCP = {
    x: endStamp + endDelta.x,
    y: rawValueAdd(endValue, endDelta.y) as T,
  };

  return {
    start: startCP,
    end: endCP,
  };
}

/**
 * Converts a transition (explicit world delta or easing enum) into an anchor-relative world delta.
 * For outbound handles the anchor is the start keypoint; for inbound handles the anchor is the end keypoint.
 */
export function resolveTransitionDelta<T extends RawValue>(
  side: "out" | "in",
  startStamp: number,
  endStamp: number,
  startValue: T,
  endValue: T,
  transition?: RawVector2 | StandardTransitionType,
): RawVector2 {
  const easing =
    transition && typeof transition !== "object" ? transition : StandardTransitionType.Cubic;

  if (transition && typeof transition === "object") {
    return transition;
  }

  const easingParams =
    side === "out" ? StandardEaseOutParameters[easing] : StandardEaseInParameters[easing];
  const xParam = easingParams.x;
  const yParam = easingParams.y;

  const span = endStamp - startStamp;
  const valueDiff = rawValueDiff(endValue, startValue);

  const xWorld = xParam * span + startStamp;
  const yWorld = rawValueAdd(startValue, rawValueMultiplyScalar(valueDiff, yParam)) as T;

  const anchorX = side === "out" ? startStamp : endStamp;
  const anchorY = side === "out" ? startValue : endValue;

  return {
    x: xWorld - anchorX,
    y: (yWorld as unknown as number) - (anchorY as unknown as number),
  };
}
