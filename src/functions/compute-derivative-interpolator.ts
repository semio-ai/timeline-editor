import { RawValue } from "@semio/utils";
import { rawValueDiff, rawValueMultiplyScalar } from "./raw-value-math";

/**
 *
 * @param interp - An interpolation function that returns a RawValue
 * @param t - The current time in the animation, typically between 0 and 1
 * @param duration - The total duration of the animation in milliseconds
 */
export function computeDerivativeInterpolator<T extends RawValue>(
  interp: (time: number) => T | undefined,
  duration: number,
): (t: number) => T | undefined {
  return (t: number): T | undefined => {
    // The interp function should reflect the start of the animation at time 0 and the end at time 1.
    // We can compute the derivative by evaluating the change in value over a small time interval.
    // We should aim for a time delta of 0.005 seconds (5 ms), which is a reasonable approximation for most animations.

    // First, compute the delta value in the interpolation range, based on the duration.
    const delta = 2.5 / duration; // Convert to a fraction of the total duration
    const valueAtA = interp(t - delta);
    const valueAtB = interp(t + delta);

    if (valueAtA === undefined || valueAtB === undefined) {
      return undefined; // If we can't get values, return undefined
    }

    const dist = rawValueDiff(valueAtA, valueAtB);
    const derivative = rawValueMultiplyScalar(dist, 1 / (2 * delta)); // Average rate of change over the interval
    // Normalize the derivative to be in m/s
    return rawValueMultiplyScalar(derivative, 1 / (duration / 1000)) as T; // Convert to per second
  };
}
