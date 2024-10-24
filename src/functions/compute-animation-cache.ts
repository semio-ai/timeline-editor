import type { Animation, AnimationCache } from "../types";

/**
 * Creates a cache of timestamped values for each track in the animation.
 * Note, the timestamps are the raw, unadjusted (with respect to namespaces) timestamps.
 * @param animation - The animation to cache
 * @returns - An AnimationCache map object
 */
export function computeAnimationCache(animation: Animation): AnimationCache {
  const cache: AnimationCache = {};
  animation.tracks.forEach((track, trackId) => {
    cache[trackId] = [];
    track.points.forEach((pointId: string) => {
      const point = animation.points.get(pointId);
      if (!point) return;
      const keyframe = animation.frames.get(point.frame);
      if (!keyframe) return;
      cache[trackId]?.push({ id: pointId, stamp: keyframe.stamp, value: point.value });
    });
    cache[trackId]?.sort((a, b) => a.stamp - b.stamp);
  });
  return cache;
}
