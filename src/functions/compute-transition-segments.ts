import { pairwise, overlappingSegments } from "@semio/utils";
import type { InstancedFrameInfo } from "../types";

/**
 * Computes the interpolation segments for the given instanced frames and track IDs.
 *
 * @param instancedFrames - An array of `InstancedFrameInfo` objects representing the frames.
 * @param trackIds - An array of track IDs to consider for computing the segments.
 * @returns An array of objects, each containing a `start` and `end` property, representing the interpolation segments.
 */
export function computeTransitionSegments(
  instancedFrames: InstancedFrameInfo[],
  trackIds: string[],
): {
  start: InstancedFrameInfo;
  end: InstancedFrameInfo;
}[] {
  const activeTracks: [number, number][] = [];
  const segments: {
    start: InstancedFrameInfo;
    end: InstancedFrameInfo;
  }[] = [];
  const sortedFrames: InstancedFrameInfo[] = instancedFrames
    .slice()
    .sort((a, b) => a.stamp - b.stamp);
  const pairs = pairwise<InstancedFrameInfo>(sortedFrames);
  // Each copy of a track has its own active range, from its first key to its
  // last: in a row of several instances the copies of one track sit at
  // different world times, and the gap between them holds no transition.
  const tracksOfRow = new Set(trackIds);
  const ranges = new Map<string, [number, number]>();
  sortedFrames.forEach((frame) => {
    frame.points.forEach((point) => {
      if (!tracksOfRow.has(point.trackId)) return;
      const copy = JSON.stringify([point.trackId, point.namespaceId, point.instanceId]);
      const range = ranges.get(copy);
      if (range) range[1] = frame.stamp;
      else ranges.set(copy, [frame.stamp, frame.stamp]);
    });
  });
  ranges.forEach((range) => activeTracks.push(range));

  const uniqueSegments = overlappingSegments(activeTracks);

  pairs.forEach(([start, end]) => {
    // If the start and end frames overlap with any of the unique segments, add the segment to the segments array
    const inside = uniqueSegments.some(([startSegment, endSegment]: [number, number]) => {
      return start.stamp >= startSegment && end.stamp <= endSegment;
    });
    // Only add segments where start and end are different frames
    if (inside && start.stamp !== end.stamp) {
      segments.push({
        start,
        end,
      });
    }
  });

  return segments;
}
