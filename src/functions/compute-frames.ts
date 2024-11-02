import type { RawValue } from "@semio/utils";
import { Track, InstancedFrameInfo } from "../types";

export function computeFrames(tracks: Record<string, Track<RawValue>>): InstancedFrameInfo[] {
  const instancedFrameInfo: InstancedFrameInfo[] = [];

  Object.entries(tracks).forEach(([trackId, trackData]: [string, Track<RawValue>]) => {
    const currentTimes = instancedFrameInfo.map((frame) => frame.stamp);
    trackData.points.forEach((point) => {
      const matchingFrameIndex = currentTimes.indexOf(point.stamp);
      if (matchingFrameIndex >= 0) {
        instancedFrameInfo[matchingFrameIndex].points.push({
          id: point.id,
          value: point.value,
          trackId,
        });
        instancedFrameInfo[matchingFrameIndex].id = `${trackId}-${point.id}`;
      } else {
        instancedFrameInfo.push({
          id: `${trackId}-${point.id}`,
          stamp: point.stamp,
          points: [{ id: point.id, value: point.value, trackId }],
        });
      }
    });
  });

  return instancedFrameInfo;
}
