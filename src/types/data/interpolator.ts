import { type RawValue } from "@semio/utils";

/**
 * A collection of Track Interpolators, indexed by id in a Map.
 */
export type AnimationInterpolator = Record<string, TrackInterpolator>;

/**
 * A function that interpolates a value for a track at a given time.
 * @param time - The time to interpolate at.
 * @returns - The interpolated value.
 */
export type TrackInterpolator = (time: number) => RawValue | undefined;
