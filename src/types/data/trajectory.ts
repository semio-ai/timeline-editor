import { RawValue } from "@semio/utils";
// A generalized interface for trajectory messages,based on the ROS trajectory message types.
// The main difference is that this interface does not restrict the datatypes to numbers.

export interface TrajectoryMessage {
  jointNames: string[];
  // In the future, rework to be generic on RawValue instead of number
  points: TrajectoryPointArray;
}

export interface PositionTrajectoryPoint {
  positions: RawValue[];
  timeFromStart: number; // in seconds
}

export interface PositionAndVelocityTrajectoryPoint {
  positions: RawValue[];
  velocities: RawValue[];
  timeFromStart: number; // in seconds
}

export interface PositionVelocityAndAccelerationTrajectoryPoint {
  positions: RawValue[];
  velocities: RawValue[];
  accelerations: RawValue[];
  timeFromStart: number; // in seconds
}

export interface PositionAndEffortTrajectoryPoint {
  positions: RawValue[];
  effort: RawValue[]; // Optional, if not provided, assume zero effort
  timeFromStart: number; // in seconds
}

export type TrajectoryPointArray =
  | PositionTrajectoryPoint[]
  | PositionAndVelocityTrajectoryPoint[]
  | PositionVelocityAndAccelerationTrajectoryPoint[]
  | PositionAndEffortTrajectoryPoint[];
