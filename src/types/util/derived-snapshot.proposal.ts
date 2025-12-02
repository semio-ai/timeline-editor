/**
 * Proposed DerivedSnapshot typing to align with explicit diff ops and projected views.
 * Draft only; not wired into runtime.
 */
import type { RawValue } from "@semio/utils";
import type { Track } from "../data/track";
import type { TrackKey, DerivedRowSnapshot, DerivedTrackSnapshot } from "./derived-snapshot";
import type { DiffOp } from "./diff";

export interface ProposedDerivedTrackView {
  trackId: string;
  /**
   * Points after applying preview diffs (non-destructive projection).
   */
  points: Track<RawValue>["points"];
  /**
   * Diff operations applied to produce this view.
   */
  appliedDiffs: DiffOp[];
}

export interface ProposedDerivedRowComputed {
  /**
   * Projected track views for this row (optional; per-row cache).
   */
  projectedTracks?: Record<string, ProposedDerivedTrackView>;
}

export interface ProposedDerivedRowSnapshot extends DerivedRowSnapshot {
  computed: DerivedRowSnapshot["computed"] & ProposedDerivedRowComputed;
}

export interface ProposedDerivedSnapshot {
  version?: number;
  dragDiffs?: DiffOp[];
  tracks: Record<TrackKey, DerivedTrackSnapshot>;
  rows: Record<string, ProposedDerivedRowSnapshot>;
}
