import { getLookup, type RawValue } from "@semio/utils";
import type { Animation, AnimationInterpolator, Track } from "../types";
import { createTrackInterpolator } from "./create-track-interpolator";
import { TrackInterpolator } from "../types/interpolator";

// @description
// This function takes in the animation data structure, and returns a function of time,
// which returns the interpolated value of the animation at that time.
// @param animation: Animation - the animation data structure
// @returns: AnimationInterpolator - a function that takes in a time and returns the interpolated
// value of the animation at that time.
export function createAnimationInterpolator(
  animations: Record<string, Animation>,
): AnimationInterpolator {
  const animationInterpolator = new Map<string, TrackInterpolator>();
  Object.values(animations).forEach((animation) => {
    Object.keys(animation.instances).forEach((instance) => {
      animation.tracks.forEach((track: Track, trackId: string) => {
        animationInterpolator.set(
          getLookup(instance, trackId),
          createTrackInterpolator(
            track,
            animation.frames,
            animation.points,
            animation.instances[instance],
          ),
        );
      });
    });
  });

  return animationInterpolator;
}
