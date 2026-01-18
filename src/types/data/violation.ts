/**
 * Single violation instance detected during playback or editing.
 */
export interface Violation {
  /** Unique violation id. */
  id: string;
  /** Stamp range (normalized timeline units) where the violation applies. */
  stampRange: { start: number; end: number };
  /** Violation category. */
  type: ViolationType;
  /** Track id where the violation was detected. */
  trackId: string;
  /** Namespace id for the violating instance. */
  namespace: string;
  /** Instance id for the violating track. */
  instanceId: string;
}

/**
 * Violation categories:
 * - Upper/Lower: value exceeds configured bounds.
 * - Velocity: derivative exceeds allowed range.
 * - Rate: enumerated value changes too frequently.
 */
export enum ViolationType {
  Upper = "upper",
  Lower = "lower",
  Velocity = "velocity",
  Rate = "rate",
}
