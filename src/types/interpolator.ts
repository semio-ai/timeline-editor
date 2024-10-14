import { type RawValue } from "@semio/utils";

// @type AnimationInterpolator
// @description A function that takes in a time and returns the interpolated value of the animation at that time.
// @param time: number - the time at which to interpolate the animation, relative to the duration of the animation (e.g. between 0 and 1).
// @returns: Record<string, RawValue> - a collection of key/value pairs, where the key is the track id and the value is the interpolated value of the track at the given time.
export type AnimationInterpolator = Map<string, TrackInterpolator>;
export type TrackInterpolator = (time: number) => RawValue | undefined;
