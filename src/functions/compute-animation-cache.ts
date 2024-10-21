import type { RawValue } from "@semio/utils";
import type { Animation, AnimationCache } from "../types";

/*
@description - Creates a cache of timestamped values for each track in the animation.
Note, the timestamps are the raw, unadjusted (with respect to namespaces) timestamps.
@param animation - The animation to cache
@return - An AnimationCache map object
*/
export function computeAnimationCache(animation: Animation): AnimationCache {
  const cache = new Map<string, { stamp: number; value: RawValue }[]>();
  animation.tracks.forEach((track, trackId) => {
    cache.set(trackId, []);
    track.points.forEach((pointId: string) => {
      const point = animation.points.get(pointId);
      if (!point) return;
      const keyframe = animation.frames.get(point.frame);
      if (!keyframe) return;
      cache.get(trackId)?.push({ stamp: keyframe.stamp, value: point.value });
    });
    cache.get(trackId)?.sort((a, b) => a.stamp - b.stamp);
  });
  return cache;
}
