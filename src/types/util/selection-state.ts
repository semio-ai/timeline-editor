import type { SourceRowData } from "./source";

export interface SelectionAnchor {
  rowId: string;
  markerId: string;
}

export interface KeypointAddress {
  trackId: string;
  keypointId: string;
}

/**
 * Keypoint-based selection model scoped to a single animation instance.
 *
 * `keypoints` stores the selected keypoints grouped by `trackId`. Each entry
 * points to a set of keypoint ids, making membership checks O(1) while keeping
 * the structure easy to diff.
 *
 * `instanceId` replaces the previous `activeAnimationInstance` and represents
 * the only instance whose keypoints may participate in the selection. When it
 * changes, the selected keypoints should be reset.
 *
 * The optional `reference` tracks the last explicit marker click for range
 * operations. Consumers must resolve the anchor lazily against computed row
 * data to avoid stale stamp values after drags mutate markers.
 */
export interface SelectionState {
  instanceId: string | null;
  keypoints: Map<string, Set<string>>;
  reference: SelectionAnchor | null;
}

/**
 * Subset of marker point data used to build selection operations.
 */
export type MarkerPoint = SourceRowData & { id: string };
