import type { RawValue } from "@semio/utils";
import { AnimationCache, InstancedFrameInfo } from "../types";

export function computeFrames(animationCache: AnimationCache): InstancedFrameInfo[] {
  const instancedFrameInfo: InstancedFrameInfo[] = [];

  Object.entries(animationCache).forEach(
    ([trackId, cachedTrackData]: [string, { id: string; stamp: number; value: RawValue }[]]) => {
      const currentTimes = instancedFrameInfo.map((frame) => frame.stamp);
      cachedTrackData.forEach((cachedFrame) => {
        const matchingFrameIndex = currentTimes.indexOf(cachedFrame.stamp);
        if (matchingFrameIndex >= 0) {
          instancedFrameInfo[matchingFrameIndex].points.push({
            id: cachedFrame.id,
            value: cachedFrame.value,
            trackId,
          });
          instancedFrameInfo[matchingFrameIndex].id = `${trackId}-${cachedFrame.id}`;
        } else {
          instancedFrameInfo.push({
            id: `${trackId}-${cachedFrame.id}`,
            stamp: cachedFrame.stamp,
            points: [{ id: cachedFrame.id, value: cachedFrame.value, trackId }],
          });
        }
      });
    },
  );

  return instancedFrameInfo;
}
