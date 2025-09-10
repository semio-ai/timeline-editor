import { DraggedKeypoint } from "../data/dragged-keypoint";

/**
 * Interface representing the drag state.
 */
export interface DragState {
  isDragging: boolean;
  draggedKeypoints: Map<string, DraggedKeypoint>; // keypointId -> drag info
  startPositions: Map<string, number>; // keypointId -> original stamp
  deltaStamp: number; // Current drag offset
}
