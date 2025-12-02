/**
 * Domain-specific diff operations for animation tracks and keypoints.
 *
 * These types are intended to serve as a stable schema for both preview
 * (non-destructive projections) and commit (canonical mutations). They are
 * declarative and id-scoped to avoid structural replacement thrash.
 *
 * Note: implementation is deferred; this file documents the intended shape.
 */
import type { RawValue } from "@semio/utils";
import type { TransitionPairing } from "../data/keypoint";
import type { EndpointTransitions } from "./segment-geometry";

/**
 * Update an existing keypoint’s fields. All properties are optional; omitted
 * fields are left unchanged.
 */
export interface UpdateKeypointDiff {
  type: "updateKeypoint";
  trackId: string;
  keypointId: string;
  changes: {
    stamp?: number;
    value?: RawValue;
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
export interface DeleteKeypointDiff {
  type: "deleteKeypoint";
  trackId: string;
  keypointId: string;
}

/**
 * Insert a new keypoint. The full payload is provided; consumers may validate
 * or normalize before applying.
 */
export interface InsertKeypointDiff {
  type: "insertKeypoint";
  trackId: string;
  keypoint: {
    id: string;
    stamp: number;
    value: RawValue;
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
export interface ReorderKeypointsDiff {
  type: "reorderKeypoints";
  trackId: string;
  order: string[]; // ordered list of keypoint ids
}

/**
 * Handle-specific deltas (optional). Can be kept separate or folded into
 * UpdateKeypointDiff.transitions depending on how the pipeline evolves.
 */
export interface HandleDiff {
  type: "handle";
  trackId: string;
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
