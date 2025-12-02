/**
 * Proposed types for computing and applying track diffs using the explicit diff schema.
 * Draft only; not wired into runtime.
 */
import type { RawValue } from "@semio/utils";
import type { Track } from "../data/track";
import type { Keypoint } from "../data/keypoint";
import type { SelectionState } from "./selection-state";
import type { TrackDiffOp } from "./diff";

export interface ComputeDiffsParams {
  trackId: string;
  trackPoints: Keypoint<RawValue>[];
  snapshotPoints?: Keypoint<RawValue>[];
  selection: SelectionState;
  dragState?: unknown; // to be replaced with ProposedDragState when adopted
  bounds?: { min: number; max: number };
  attributePath?: string[];
}

export type ComputeDiffsFn = (params: ComputeDiffsParams) => TrackDiffOp[];

export type ApplyDiffsFn = (track: Track<RawValue>, diffs: TrackDiffOp[]) => void;

/**
 * Apply diffs to an array of points non-destructively (returns new array).
 */
export type ProjectDiffsFn = (
  points: Keypoint<RawValue>[],
  diffs: TrackDiffOp[],
) => Keypoint<RawValue>[];
