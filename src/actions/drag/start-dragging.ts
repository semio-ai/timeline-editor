import type { InstancedFrameInfo } from "../../types";
import type {
  DragState,
  DraggedKeypoint,
  AnimationStoreGetter,
  AnimationStoreSetter,
} from "../../store-types";

/**
 * Start a drag operation with the current selection or provided selection.
 * All positions are stored in normalized 0-1 space.
 *
 * @param get - The store getter function
 * @param set - The store setter function
 * @param selection - Optional selection to drag, defaults to current selection
 */
export function startDragging(
  get: AnimationStoreGetter,
  set: AnimationStoreSetter,
  selection?: InstancedFrameInfo[],
): void {
  const state = get();

  // Use provided selection or current selection
  const currentSelection = selection || state.selection;

  // If no selection, nothing to drag
  if (currentSelection.length === 0) {
    return;
  }

  const draggedKeypoints = new Map<string, DraggedKeypoint>();
  const startPositions = new Map<string, number>();

  // Process each frame in the selection
  currentSelection.forEach((frame) => {
    frame.points.forEach((point) => {
      // Store positions in normalized 0-1 space
      // frame.stamp is already in normalized space
      draggedKeypoints.set(point.id, {
        trackId: point.trackId,
        keypointId: point.id,
        originalStamp: frame.stamp, // This is in 0-1 normalized space
        currentOffset: 0,
      });
      startPositions.set(point.id, frame.stamp); // Also in 0-1 normalized space
    });
  });

  // Set the drag state with normalized positions
  const dragState: DragState = {
    isDragging: true,
    draggedKeypoints,
    startPositions,
    deltaStamp: 0, // Delta will also be in normalized space
  };

  set({ dragState });
}
