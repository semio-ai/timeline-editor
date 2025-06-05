import type { RawValue } from "@semio/utils";
import { Track, InstancedFrameInfo } from "../types";

/**
 * Computes the frames from the given tracks.
 *
 * This function processes the provided tracks and generates an array of `InstancedFrameInfo` objects.
 * Each `InstancedFrameInfo` object contains a unique identifier, a timestamp, and an array of points
 * that belong to that frame.
 *
 * @param tracks - A record of track IDs to `Track` objects. Each `Track` object contains an array of points.
 * @returns An array of `InstancedFrameInfo` objects, each representing a frame with its associated points.
 */
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

  return instancedFrameInfo.toSorted((a, b) => a.stamp - b.stamp);
}
