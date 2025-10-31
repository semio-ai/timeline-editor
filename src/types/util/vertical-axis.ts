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
}
