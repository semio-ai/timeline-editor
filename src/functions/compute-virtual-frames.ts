import type { RawValue } from "@semio/utils";
import { Track, InstancedFrameInfo } from "../types";
import { DragState } from "../store-types";
import { applyDragOffsets } from "./apply-drag-offsets";
import { computeFrames } from "./compute-frames";

/**
 * Computes virtual frames with drag preview positions applied.
 * This function creates frames that show where keypoints would be positioned
 * during a drag operation without modifying the actual track data.
 *
 * @param tracks - A record of track IDs to Track objects
 * @param dragState - Current drag state, or null if not dragging
 * @returns Array of InstancedFrameInfo objects with virtual positions
 */
export function computeVirtualFrames(
  tracks: Record<string, Track<RawValue>>,
  dragState: DragState | null,
): InstancedFrameInfo[] {
  if (!dragState?.isDragging) {
    // No drag operation active, return normal frames
    return computeFrames(tracks);
  }

  // Apply virtual drag offsets to create preview tracks
  const virtualTracks = applyDragOffsets(tracks, dragState);

  // Compute frames with drag prevention for dragged keypoints
  const draggedKeypointIds = Array.from(dragState.draggedKeypoints.keys());
  return computeFrames(virtualTracks, draggedKeypointIds);
}

/**
 * Computes frames with drag prevention, ensuring dragged keypoints don't merge
 * during the drag operation.
 *
 * @param tracks - A record of track IDs to Track objects
 * @param dragState - Current drag state
 * @returns Array of InstancedFrameInfo objects with drag prevention applied
 */
export function computeFramesWithDragPrevention(
  tracks: Record<string, Track<RawValue>>,
  dragState: DragState,
): InstancedFrameInfo[] {
  const draggedKeypointIds = Array.from(dragState.draggedKeypoints.keys());
  return computeFrames(tracks, draggedKeypointIds);
}

/**
 * Checks if a frame contains any dragged keypoints.
 *
 * @param frame - The frame to check
 * @param dragState - Current drag state
 * @returns True if the frame contains dragged keypoints, false otherwise
 */
export function frameContainsDraggedKeypoints(
  frame: InstancedFrameInfo,
  dragState: DragState | null,
): boolean {
  if (!dragState?.isDragging) {
    return false;
  }

  return frame.points.some((point) => dragState.draggedKeypoints.has(point.id));
}

/**
 * Gets the virtual position (stamp) of a frame, accounting for drag offsets.
 * If the frame contains dragged keypoints, returns their virtual position.
 * Otherwise, returns the original stamp.
 *
 * @param frame - The frame to get virtual position for
 * @param dragState - Current drag state
 * @returns Virtual timestamp of the frame
 */
export function getVirtualFrameStamp(
  frame: InstancedFrameInfo,
  dragState: DragState | null,
): number {
  if (!dragState?.isDragging || !frameContainsDraggedKeypoints(frame, dragState)) {
    return frame.stamp;
  }

  // Find the first dragged keypoint in this frame to get its virtual position
  const draggedPoint = frame.points.find((point) => dragState.draggedKeypoints.has(point.id));

  if (draggedPoint) {
    const dragInfo = dragState.draggedKeypoints.get(draggedPoint.id);
    if (dragInfo) {
      return dragInfo.originalStamp + dragInfo.currentOffset;
    }
  }

  return frame.stamp;
}

/**
 * Filters frames to return only those that contain dragged keypoints.
 *
 * @param frames - Array of frames to filter
 * @param dragState - Current drag state
 * @returns Array of frames containing dragged keypoints
 */
export function getDraggedFrames(
  frames: InstancedFrameInfo[],
  dragState: DragState | null,
): InstancedFrameInfo[] {
  if (!dragState?.isDragging) {
    return [];
  }

  return frames.filter((frame) => frameContainsDraggedKeypoints(frame, dragState));
}

/**
 * Filters frames to return only those that do NOT contain dragged keypoints.
 *
 * @param frames - Array of frames to filter
 * @param dragState - Current drag state
 * @returns Array of frames not containing dragged keypoints
 */
export function getNonDraggedFrames(
  frames: InstancedFrameInfo[],
  dragState: DragState | null,
): InstancedFrameInfo[] {
  if (!dragState?.isDragging) {
    return frames;
  }

  return frames.filter((frame) => !frameContainsDraggedKeypoints(frame, dragState));
}

/**
 * Creates a mapping of keypoint IDs to their virtual positions during drag.
 *
 * @param dragState - Current drag state
 * @returns Map of keypoint ID to virtual timestamp
 */
export function getVirtualKeypointPositions(dragState: DragState | null): Map<string, number> {
  const positions = new Map<string, number>();

  if (dragState?.isDragging) {
    dragState.draggedKeypoints.forEach((dragInfo, keypointId) => {
      positions.set(keypointId, dragInfo.originalStamp + dragInfo.currentOffset);
    });
  }

  return positions;
}
