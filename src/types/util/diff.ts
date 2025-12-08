/**
 * Domain-specific diff operations for animation tracks and keypoints.
 *
 * Lifecycle:
 * - Preview: build a set of DiffOps (or handle deltas) to project UI changes without mutating
 *   canonical tracks. Derived snapshots consume the same shapes to render the preview.
 * - Commit: replay the identical ops against canonical tracks, then rebuild derived snapshots.
 * - Cancel: discard pending ops; canonical + derived remain unchanged.
 *
 * These types are declarative and id-scoped to avoid structural replacement thrash. Implementation
 * is still in progress; this file documents the intended shape.
 */
import type { RawValue } from "@semio/utils";
import type { TransitionPairing } from "../data/keypoint";
import type { EndpointTransitions } from "./segment-geometry";

/**
 * Update an existing keypoint’s fields. All properties are optional; omitted
 * fields are left unchanged.
 */
/** Update an existing keypoint’s fields (preview and commit use the same shape). */
export interface UpdateKeypointDiff {
  type: "updateKeypoint";
  /** Track containing the keypoint. */
  trackId: string;
  /** Keypoint id to update. */
  keypointId: string;
  changes: {
    /** Optional new stamp. */
    stamp?: number;
    /** Optional new value. */
    value?: RawValue;
    /** Optional transition updates (in/out/pairing). */
    transitions?: {
      in?: EndpointTransitions["endIn"];
      out?: EndpointTransitions["startOut"];
      pairing?: TransitionPairing;
    };
  };
}

/**
 * Remove a keypoint by id. Useful for overwrite/erase scenarios.
 */
/** Remove a keypoint by id. */
export interface DeleteKeypointDiff {
  type: "deleteKeypoint";
  /** Track containing the keypoint. */
  trackId: string;
  /** Keypoint id to remove. */
  keypointId: string;
}

/**
 * Insert a new keypoint. The full payload is provided; consumers may validate
 * or normalize before applying.
 */
export interface InsertKeypointDiff {
  type: "insertKeypoint";
  /** Track to receive the new keypoint. */
  trackId: string;
  keypoint: {
    /** New keypoint id. */
    id: string;
    /** Stamp of the new keypoint. */
    stamp: number;
    /** Value of the new keypoint. */
    value: RawValue;
    /** Optional transitions for the new keypoint. */
    transitions?: {
      in?: EndpointTransitions["endIn"];
      out?: EndpointTransitions["startOut"];
      pairing?: TransitionPairing;
    };
  };
}

/**
 * Reorder keypoints within a track by specifying the desired id order.
 */
/** Reorder keypoints within a track by specifying the desired id order. */
export interface ReorderKeypointsDiff {
  type: "reorderKeypoints";
  /** Track whose keypoints are reordered. */
  trackId: string;
  order: string[]; // ordered list of keypoint ids
}

/**
 * Handle-specific deltas (optional). Can be kept separate or folded into
 * UpdateKeypointDiff.transitions depending on how the pipeline evolves.
 */
/**
 * Handle-specific deltas (optional). Can be kept separate or folded into
 * UpdateKeypointDiff.transitions depending on how the pipeline evolves.
 */
export interface HandleDiff {
  type: "handle";
  /** Track containing the handle/keypoint. */
  trackId: string;
  /** Keypoint id whose handles are updated. */
  keypointId: string;
  changes: {
    in?: EndpointTransitions["endIn"];
    out?: EndpointTransitions["startOut"];
    pairing?: TransitionPairing;
  };
}

/**
 * Union of supported diff operations. Preview and commit should consume the
 * same op set; preview may project a non-destructive view, while commit mutates
 * canonical data.
 */
export type TrackDiffOp =
  | UpdateKeypointDiff
  | DeleteKeypointDiff
  | InsertKeypointDiff
  | ReorderKeypointsDiff;

export type DiffOp = TrackDiffOp | HandleDiff;
