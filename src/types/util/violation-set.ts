import type { Violation } from "../data/violation";

/** Aggregated violations for a track, grouped into renderable segments. */
export interface ViolationSet {
  /** Track id for this violation set. */
  id: string;
  /** Violations keyed by id. */
  violations: Record<string, Violation>;
  /** Renderable segments that reference violations. */
  segments: ViolationSegment[];
}

/** Range of stamps associated with one or more violation ids. */
export interface ViolationSegment {
  /** Unique segment id. */
  id: string;
  /** Stamp range covered by this segment. */
  stampRange: { start: number; end: number };
  /** Violation ids contained in this segment. */
  violations: string[];
}
