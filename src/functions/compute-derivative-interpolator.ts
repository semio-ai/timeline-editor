import { RawValue } from "@semio/utils";
import { rawValueDiff, rawValueMultiplyScalar } from "./raw-value-math";

/**
 * Creates a derivative interpolator from a value interpolator.
 * Computes the rate of change (per second) at any given time.
 *
 * @param interp - An interpolation function that returns a RawValue for a given time in ms
 * @param duration - The total duration of the animation in milliseconds
 */
export function computeDerivativeInterpolator<T extends RawValue>(
  interp: (time: number) => T | undefined,
  _duration: number,
): (t: number) => T | undefined {
  return (t: number): T | undefined => {
    // In v2 format, t is in milliseconds. We compute the derivative by evaluating
    // the change in value over a small time interval (~5ms).
    const delta = 2.5; // Half-interval in ms (total interval = 5ms)
    const valueAtA = interp(t - delta);
    const valueAtB = interp(t + delta);

    if (valueAtA === undefined || valueAtB === undefined) {
      return undefined;
    }

    // Rate of change over the 5ms interval (value units per ms)
    const dist = rawValueDiff(valueAtA, valueAtB);
    const derivative = rawValueMultiplyScalar(dist, 1 / (2 * delta));
    // Convert from per-ms to per-second
    return rawValueMultiplyScalar(derivative, 1000) as T;
  };
}
