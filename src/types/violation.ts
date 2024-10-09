export interface Violation {
  id: string;
  stampRange: [number, number];
  message: string;
  type: ViolationType;
  trackId: string;
  namespace: string;
}

export enum ViolationType {
  // The track values are outside the range allowed in the AnimatableValue's information
  Boundary = "boundary",
  // The track values are changing at a rate outside the range allowed in the AnimatableValue's information
  Velocity = "velocity",
  // The frequency of changing a given enumerable value is too high for that allowed in the AnimatableValue's information
  Rate = "rate",
}
