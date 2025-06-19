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
 * @param draggingFrameIds - Optional array of frame IDs that are currently being dragged and should not be merged.
 * @returns An array of `InstancedFrameInfo` objects, each representing a frame with its associated points.
 */
export function computeFrames(
  tracks: Record<string, Track<RawValue>>,
  draggingFrameIds?: string[],
): InstancedFrameInfo[] {
  const instancedFrameInfo: InstancedFrameInfo[] = [];

  Object.entries(tracks).forEach(([trackId, trackData]: [string, Track<RawValue>]) => {
    trackData.points.forEach((point) => {
      const isDragging = draggingFrameIds?.includes(point.id) ?? false;

      // Find existing frame with matching timestamp and compatible dragging state
      const matchingFrameIndex = instancedFrameInfo.findIndex((frame) => {
        if (frame.stamp !== point.stamp) return false;

        // Check if all points in this frame have the same dragging state as the current point
        const framePointsDragging = frame.points.every(
          (p) => draggingFrameIds?.includes(p.id) ?? false,
        );

        return framePointsDragging === isDragging;
      });

      if (matchingFrameIndex >= 0) {
        // Add point to existing frame
        instancedFrameInfo[matchingFrameIndex].points.push({
          id: point.id,
          value: point.value,
          trackId,
        });
        // Update frame ID based on all points in this frame
        const pointIds = instancedFrameInfo[matchingFrameIndex].points
          .map((p) => p.id)
          .sort()
          .join("-");
        instancedFrameInfo[matchingFrameIndex].id = pointIds;
      } else {
        // Create new frame
        instancedFrameInfo.push({
          id: point.id,
          stamp: point.stamp,
          points: [{ id: point.id, value: point.value, trackId }],
        });
      }
    });
  });

  return instancedFrameInfo.toSorted((a, b) => a.stamp - b.stamp);
}
