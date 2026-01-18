import { RawValue } from "@semio/utils";

/**
 * ROS-inspired trajectory message for exporting track data.
 * Uses RawValue arrays instead of number-only payloads.
 */
export interface TrajectoryMessage {
  /** Names of joints/outputs in the order used by the point arrays. */
  jointNames: string[];
  /** Trajectory points (position-only or extended variants). */
  points: TrajectoryPointArray;
}

/** Point with positions only. */
export interface PositionTrajectoryPoint {
  /** Position values per joint/output. */
  positions: RawValue[];
  /** Time from start in seconds. */
  timeFromStart: number;
}

/** Point with positions and velocities. */
export interface PositionAndVelocityTrajectoryPoint {
  /** Position values per joint/output. */
  positions: RawValue[];
  /** Velocity values per joint/output. */
  velocities: RawValue[];
  /** Time from start in seconds. */
  timeFromStart: number;
}

/** Point with positions, velocities, and accelerations. */
export interface PositionVelocityAndAccelerationTrajectoryPoint {
  /** Position values per joint/output. */
  positions: RawValue[];
  /** Velocity values per joint/output. */
  velocities: RawValue[];
  /** Acceleration values per joint/output. */
  accelerations: RawValue[];
  /** Time from start in seconds. */
  timeFromStart: number;
}

/** Point with positions and optional effort. */
export interface PositionAndEffortTrajectoryPoint {
  /** Position values per joint/output. */
  positions: RawValue[];
  /** Effort values per joint/output; use empty array to imply zero effort. */
  effort: RawValue[];
  /** Time from start in seconds. */
  timeFromStart: number;
}

/** Union of supported trajectory point array shapes. */
export type TrajectoryPointArray =
  | PositionTrajectoryPoint[]
  | PositionAndVelocityTrajectoryPoint[]
  | PositionVelocityAndAccelerationTrajectoryPoint[]
  | PositionAndEffortTrajectoryPoint[];
