import { pairwise, overlappingSegments } from "@semio/utils";
import type { InstancedFrameInfo } from "../types";

/**
 * Computes the interpolation segments for the given instanced frames and track IDs.
 *
 * @param instancedFrames - An array of `InstancedFrameInfo` objects representing the frames.
 * @param trackIds - An array of track IDs to consider for computing the segments.
 * @returns An array of objects, each containing a `start` and `end` property, representing the interpolation segments.
 */
export function computeInterpolationSegments(
  instancedFrames: InstancedFrameInfo[],
  trackIds: string[],
): { start: InstancedFrameInfo; end: InstancedFrameInfo }[] {
  const activeTracks: [number, number][] = [];
  const segments: { start: InstancedFrameInfo; end: InstancedFrameInfo }[] = [];
  const sortedFrames: InstancedFrameInfo[] = instancedFrames
    .slice()
    .sort((a, b) => a.stamp - b.stamp);
  const pairs = pairwise<InstancedFrameInfo>(sortedFrames);
  trackIds.forEach((trackId) => {
    // Find the first and last frame for each track and store it in activeTracks
    const firstFrame = instancedFrames.find((frame) =>
      frame.points.some((point) => point.trackId === trackId),
    );
    const lastFrame = instancedFrames
      .slice()
      .reverse()
      .find((frame) => frame.points.some((point) => point.trackId === trackId));
    if (firstFrame?.stamp !== undefined && lastFrame?.stamp !== undefined) {
      activeTracks.push([firstFrame.stamp, lastFrame.stamp]);
    }
  });

  const uniqueSegments = overlappingSegments(activeTracks);

  pairs.forEach(([start, end]) => {
    // If the start and end frames overlap with any of the unique segments, add the segment to the segments array
    const inside = uniqueSegments.some(([startSegment, endSegment]: [number, number]) => {
      return start.stamp >= startSegment && end.stamp <= endSegment;
    });
    if (inside) {
      segments.push({ start, end });
    }
  });

  return segments;
}
