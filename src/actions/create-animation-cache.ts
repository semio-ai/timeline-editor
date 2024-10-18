import type { RawValue } from "@semio/utils";
import type { Animation, AnimationCache } from "../types";

export function createAnimationCache(animation: Animation): AnimationCache {
  const cache = new Map<string, { stamp: number; value: RawValue }[]>();
  animation.trackOrder.forEach((trackId) => {
    const track = animation.tracks.get(trackId);
    if (!track) return;
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
