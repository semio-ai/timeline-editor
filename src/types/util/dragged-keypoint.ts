/**
 * Interface representing a keypoint that is being dragged.
 */
export interface DraggedKeypoint {
  trackId: string;
  keypointId: string;
  originalStamp: number;
  currentOffset: number;
}
