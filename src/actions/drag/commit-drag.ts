import { produce } from "immer";
import type { RawValue } from "@semio/utils";
import type {
  AnimationStoreGetter,
  AnimationStoreSetter,
  DraggedKeypoint,
} from "../../store-types";
import type { Track } from "../../types";
import { computeFrames } from "../../functions";

/**
 * Commit the current drag operation, applying all changes.
 * @param get - The store getter function
 * @param set - The store setter function
 */
export function commitDrag(get: AnimationStoreGetter, set: AnimationStoreSetter): void {
  const state = get();

  // Exit early if not currently dragging
  if (!state.dragState?.isDragging) {
    return;
  }

  // Store the IDs of all selected keypoints before updating
  const selectedKeypointIds = new Set<string>();
  state.selection.forEach((frame) => {
    frame.points.forEach((point) => {
      selectedKeypointIds.add(point.id);
    });
  });

  // Apply updates and compute new selection in a single state update
  set(
    produce((draft) => {
      // Apply drag offsets to all dragged keypoints
      draft.dragState?.draggedKeypoints.forEach((dragInfo: DraggedKeypoint) => {
        const track = draft.tracks[dragInfo.trackId];
        if (track) {
          const point = track.points.find((p: any) => p.id === dragInfo.keypointId);
          if (point) {
            point.stamp = dragInfo.originalStamp + dragInfo.currentOffset;
          }
        }
      });

      // Sort points after updates to maintain chronological order
      (Object.values(draft.tracks) as Track<RawValue>[]).forEach((track) => {
        track.points.sort((a: any, b: any) => a.stamp - b.stamp);
      });

      // Recompute frames from updated tracks
      const newFrames = computeFrames(draft.tracks);

      // Build new selection to maintain multi-selection after drag
      draft.selection = newFrames.filter((frame) => {
        // Select this frame if it contains at least one previously selected point
        return frame.points.some((point) => selectedKeypointIds.has(point.id));
      });

      // Update reference marker if it was selected
      if (draft.referenceMarker) {
        const referenceKeypointIds = draft.referenceMarker.marker.points.map((p: any) => p.id);
        const wasReferenceSelected = referenceKeypointIds.some((id: string) =>
          selectedKeypointIds.has(id),
        );

        if (wasReferenceSelected) {
          // Find the new frame for the reference marker
          const newReferenceFrame = newFrames.find((frame) =>
            frame.points.some((point) => referenceKeypointIds.includes(point.id)),
          );

          if (newReferenceFrame) {
            draft.referenceMarker.marker = newReferenceFrame;
          }
        }
      }

      // Clear drag state
      draft.dragState = null;
    }),
  );
}
