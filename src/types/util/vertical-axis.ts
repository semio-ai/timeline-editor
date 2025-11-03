export enum VerticalAxis {
  Uniform = "uniform",
  Normalized = "normalized",
  // TODO: Add a custom axis option in the future,
  // Which will allow individual rows to have their own vertical axis scaling and offset
}

export interface VerticalAxisRange {
  min: number;
  max: number;
  visualOffset?: number;
  // Optional scaling factor applied to the visual range after padding/offset.
  // 1 means no additional scaling; values < 1 shrink the plotted vertical span, > 1 expand it.
  visualScale?: number;
}
