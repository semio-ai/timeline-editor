import { type RawValue } from "@semio/data";

/** Interpolators for a track value and its derivative. */
export interface ValueAndDerivativeInterpolators {
  /** Value interpolator. */
  value: TrackInterpolator;
  /** Derivative interpolator (velocity). */
  derivative: TrackInterpolator;
}

/**
 * Collection of per-track interpolators keyed by track key.
 */
export type TrackInterpolators = Record<string, ValueAndDerivativeInterpolators>;

/**
 * Interpolate a track's value at a given stamp.
 * Returns undefined when the interpolator has insufficient data.
 */
export type TrackInterpolator = (time: number) => RawValue | undefined;
