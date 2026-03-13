/** Global vertical axis scaling modes for rows. */
export enum VerticalAxis {
  /** Use shared bounds across rows. */
  Uniform = "uniform",
  /** Normalize each row to its own bounds. */
  Normalized = "normalized",
  // TODO: Add a custom axis option in the future,
  // Which will allow individual rows to have their own vertical axis scaling and offset
}

/** Explicit vertical axis range and visual adjustments for a view. */
export interface VerticalAxisRange {
  /** Lower bound in literal value space. */
  min: number;
  /** Upper bound in literal value space. */
  max: number;
  /** Optional visual offset applied after bounds are computed. */
  visualOffset?: number;
  // Optional scaling factor applied to the visual range after padding/offset.
  // 1 means no additional scaling; values < 1 shrink the plotted vertical span, > 1 expand it.
  visualScale?: number;
}
