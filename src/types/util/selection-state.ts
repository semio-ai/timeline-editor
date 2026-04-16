import type { SelectionFrame, SelectionPointRef } from "./render-types";

export interface SelectionAnchor {
  /** Row id containing the anchor marker. */
  rowId: string;
  /** Marker id used as the anchor. */
  markerId: string;
}

export interface KeypointAddress {
  /** Track id for the keypoint. */
  trackId: string;
  /** Keypoint id. */
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
  /** Active instance id for the selection (null when none). */
  instanceId: string | null;
  /** Selected keypoints grouped by track id. */
  keypoints: Map<string, Set<string>>;
  /** Anchor used for range selection operations. */
  reference: SelectionAnchor | null;
  /** Targeted track source row IDs (leaf rows only; group state is derived). */
  targetedTracks: Set<string>;
  /** Last targeted row ID for shift+click range operations. */
  targetAnchor: string | null;
}

/** Subset of marker point data used to build selection operations. */
export type MarkerPoint = SelectionPointRef;

export type { SelectionFrame, SelectionPointRef };
