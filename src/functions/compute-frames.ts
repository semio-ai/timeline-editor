import type { RawValue } from "@semio/utils";
import type { Track, InstancedFrameInfo, SourceRow, Keypoint } from "../types";

interface ComputeFramesOptions {
  draggingKeypointIds?: Set<string>;
  transformKeypoint?: (
    keypoint: Keypoint<RawValue>,
    context: { trackId: string; source: SourceRow["data"][number] },
  ) => Keypoint<RawValue>;
  /**
   * When true, frames at the same stamp are merged regardless of dragging state.
   * Useful for marker projections where drag vs non-drag points should coexist.
   */
  ignoreDraggingState?: boolean;
  /**
   * If provided, any frame containing this keypoint id will use it as the frame id
   * to keep React keys stable during drag.
   */
  anchorFrameKey?: string;
}

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
  options: ComputeFramesOptions = {},
): InstancedFrameInfo[] {
  const instancedFrameInfo: InstancedFrameInfo[] = [];
  const { draggingKeypointIds, transformKeypoint } = options;

  sourceRow.data.forEach((sourceRowData) => {
    const trackId = sourceRowData.trackId;
    const emittedTrackId = (sourceRowData as any).trackIdBase ?? trackId;
    const trackData = tracks[trackId];
    trackData.points.forEach((point) => {
      const previewPoint = transformKeypoint?.(point, { trackId, source: sourceRowData }) ?? point;

      const isDragging = draggingKeypointIds?.has(point.id) ?? false;

      // Find existing frame with matching timestamp (and, optionally, matching dragging state)
      const matchingFrameIndex = instancedFrameInfo.findIndex((frame) => {
        if (frame.stamp !== previewPoint.stamp) return false;

        if (options.ignoreDraggingState) {
          return true;
        }

        // Check if all points in this frame have the same dragging state as the current point
        const framePointsDragging = frame.points.every(
          (p) => draggingKeypointIds?.has(p.id) ?? false,
        );

        return framePointsDragging === isDragging;
      });

      // If the sourceRowData specifies an attribute, extract the specific value, and set the type of point to number.
      const valueType = sourceRowData.attribute !== undefined ? "number" : sourceRowData.type;
      const value =
        sourceRowData.attribute && typeof previewPoint.value === "object"
          ? (previewPoint.value as any)[sourceRowData.attribute]
          : previewPoint.value;

      if (matchingFrameIndex >= 0) {
        // Add point to existing frame
        const exists = instancedFrameInfo[matchingFrameIndex].points.some(
          (p) => p.id === previewPoint.id && p.trackId === sourceRowData.trackId,
        );
        if (!exists) {
          instancedFrameInfo[matchingFrameIndex].points.push({
            ...sourceRowData,
            id: previewPoint.id,
            type: valueType,
            value,
            trackId: emittedTrackId,
          });
        }
        // Update frame ID based on all points in this frame
        const pointIds = instancedFrameInfo[matchingFrameIndex].points
          .map((p) => p.id)
          .sort()
          .join("-");
        instancedFrameInfo[matchingFrameIndex].id = pointIds;
        if (
          options.anchorFrameKey &&
          instancedFrameInfo[matchingFrameIndex].points.some((p) => p.id === options.anchorFrameKey)
        ) {
          instancedFrameInfo[matchingFrameIndex].id = options.anchorFrameKey;
        }

        // If this is the first point being added and it has transitions, use them
        // For multiple points, we clear transitions to avoid conflicts
        if (
          instancedFrameInfo[matchingFrameIndex].points.length === 1 &&
          previewPoint.transitions
        ) {
          instancedFrameInfo[matchingFrameIndex].transitions = previewPoint.transitions;
        } else if (instancedFrameInfo[matchingFrameIndex].points.length > 1) {
          // Clear transitions when multiple points exist at same timestamp
          instancedFrameInfo[matchingFrameIndex].transitions = undefined;
        }
      } else {
        // Create new frame
        const frame: InstancedFrameInfo = {
          id: previewPoint.id,
          stamp: previewPoint.stamp,
          points: [
            {
              ...sourceRowData,
              id: previewPoint.id,
              value,
              type: valueType,
              trackId: emittedTrackId,
            },
          ],
          transitions: previewPoint.transitions,
        };
        if (options.anchorFrameKey && previewPoint.id === options.anchorFrameKey) {
          frame.id = options.anchorFrameKey;
        }
        instancedFrameInfo.push(frame);
      }
    });
  });

  return instancedFrameInfo.toSorted((a, b) => a.stamp - b.stamp);
}
