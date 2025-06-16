import { type RawValue } from "@semio/utils";

export interface InterpolatorCollection {
  value: TrackInterpolator;
  derivative: TrackInterpolator;
}

/**
 * A collection of Track Interpolators, indexed by id in a Map.
 */
export type AnimationInterpolator = Record<string, InterpolatorCollection>;

/**
 * A function that interpolates a value for a track at a given time.
 * @param time - The time to interpolate at.
 * @returns - The interpolated value.
 */
export type TrackInterpolator = (time: number) => RawValue | undefined;
