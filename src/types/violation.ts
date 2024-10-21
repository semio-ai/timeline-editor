export interface Violation {
  id: string;
  stampRange: { start: number; end: number };
  type: ViolationType;
  trackId: string;
  namespace: string;
}

/*
@description The type of violation that has occurred
These have the following types: Boundary, Velocity, Rate.
Upper - The track values are above the range allowed
Lower - The track values are below the range allowed
Velocity - The track values are changing at a rate outside the range allowed
Rate - The frequency of changing a given enumerable value is too high
*/
export enum ViolationType {
  Upper = "upper",
  Lower = "lower",
  Velocity = "velocity",
  Rate = "rate",
}
