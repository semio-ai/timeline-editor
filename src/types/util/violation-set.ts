import type { Violation } from "./violation";

/**
 * A set of violations to render in a given track
 * @param id - The id of the track
 * @param violations - A map of violations indexed by violation id
 * @param segments - A list of segments in the track that contain violations
 */
export interface ViolationSet {
  id: string;
  violations: Record<string, Violation>;
  segments: ViolationSegment[];
}

export interface ViolationSegment {
  id: string;
  stampRange: { start: number; end: number };
  violations: string[];
}
