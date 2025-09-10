import { produce } from "immer";
import type { RawValue } from "@semio/utils";
import type { Track, DragState } from "../types";

/**
 * Apply drag offsets to tracks to create virtual preview positions.
 * All positions are in normalized 0-1 space.
 *
 * @param tracks - The original tracks with positions in normalized 0-1 space
 * @param dragState - The current drag state with offsets in normalized 0-1 space
 * @returns Virtual tracks with drag preview positions applied
 */
export function applyDragOffsets(
  tracks: Record<string, Track<RawValue>>,
  dragState: DragState,
): Record<string, Track<RawValue>> {
  return produce(tracks, (draft) => {
    dragState.draggedKeypoints.forEach((dragInfo) => {
      const track = draft[dragInfo.trackId];
      if (!track) return;

      const point = track.points.find((p) => p.id === dragInfo.keypointId);
      if (point) {
        // Calculate new position in normalized 0-1 space
        const newStamp = dragInfo.originalStamp + dragInfo.currentOffset;

        // Ensure the new position is a valid finite number
        if (!isFinite(newStamp)) {
          console.warn(
            `Invalid position calculated for keypoint ${dragInfo.keypointId}:`,
            newStamp,
          );
          return;
        }

        // Clamp to valid normalized range [0, 1]
        const clampedStamp = Math.max(0, Math.min(1, newStamp));

        point.stamp = clampedStamp;
      }
    });

    // Re-sort points after applying offsets to maintain chronological order
    Object.values(draft).forEach((track) => {
      track.points.sort((a, b) => a.stamp - b.stamp);
    });
  });
}
