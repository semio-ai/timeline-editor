export interface TrackTrajectory {
  jointNames: string[];
  // In the future, rework to be generic on RawValue instead of number
  jointAngles: number[][];
  times: number[][];
  relative?: boolean;
}
