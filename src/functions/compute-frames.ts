import type { RawValue } from "@semio/utils";
import { Track, InstancedFrameInfo, SourceRow } from "../types";

/**
 * Computes the frames from the given tracks.
 *
 * This function processes the provided tracks and generates an array of `InstancedFrameInfo` objects.
 * Each `InstancedFrameInfo` object contains a unique identifier, a timestamp, and an array of points
 * that belong to that frame.
 *
 * @param tracks - A record of track IDs to `Track` objects. Each `Track` object contains an array of points.
 * @param sourceRow - A `SourceRow` object that contains data about the source of the data.
 * @param draggingFrameIds - Optional array of frame IDs that are currently being dragged and should not be merged.
 * @returns An array of `InstancedFrameInfo` objects, each representing a frame with its associated points.
 */
export function computeFrames(
  tracks: Record<string, Track<RawValue>>,
  sourceRow: SourceRow,
  draggingFrameIds?: string[],
): InstancedFrameInfo[] {
  const instancedFrameInfo: InstancedFrameInfo[] = [];

  sourceRow.data.forEach((sourceRowData) => {
    const trackId = sourceRowData.trackId;
    const trackData = tracks[trackId];
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

      // If the sourceRowData specifies an attribute, extract the specific value, and set the type of point to number.
      const valueType = sourceRowData.attribute !== undefined ? "number" : sourceRowData.type;
      const value =
        sourceRowData.attribute && typeof point.value === "object"
          ? (point.value as any)[sourceRowData.attribute]
          : point.value;

      if (matchingFrameIndex >= 0) {
        // Add point to existing frame
        instancedFrameInfo[matchingFrameIndex].points.push({
          ...sourceRowData,
          id: point.id,
          type: valueType,
          value,
        });
        // Update frame ID based on all points in this frame
        const pointIds = instancedFrameInfo[matchingFrameIndex].points
          .map((p) => p.id)
          .sort()
          .join("-");
        instancedFrameInfo[matchingFrameIndex].id = pointIds;

        // If this is the first point being added and it has transitions, use them
        // For multiple points, we clear transitions to avoid conflicts
        if (instancedFrameInfo[matchingFrameIndex].points.length === 1 && point.transitions) {
          instancedFrameInfo[matchingFrameIndex].transitions = point.transitions;
        } else if (instancedFrameInfo[matchingFrameIndex].points.length > 1) {
          // Clear transitions when multiple points exist at same timestamp
          instancedFrameInfo[matchingFrameIndex].transitions = undefined;
        }
      } else {
        // Create new frame
        instancedFrameInfo.push({
          id: point.id,
          stamp: point.stamp,
          points: [{ ...sourceRowData, id: point.id, value, type: valueType, trackId }],
          transitions: point.transitions,
        });
      }
    });
  });

  return instancedFrameInfo.toSorted((a, b) => a.stamp - b.stamp);
}
