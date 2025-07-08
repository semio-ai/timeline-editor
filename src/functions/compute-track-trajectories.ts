import { getLookup, PlayerDirection, RawValue } from "@semio/utils";
import { InstancedFrameInfo, Track, TrackInterpolators } from "../types";
import {
  PositionAndEffortTrajectoryPoint,
  PositionAndVelocityTrajectoryPoint,
  PositionVelocityAndAccelerationTrajectoryPoint,
  TrajectoryMessage,
  TrajectoryPointArray,
} from "../types/data/trajectory";
import { computeFrames } from "./compute-frames";
import { rawValueMultiplyScalar } from "./raw-value-math";

/**
 *
 * @param tracks - The set of tracks indexed by their *name* (intended for the trajectory jointNames field)
 * @param trackInterpolators - The set of interpolators indexed by their *lookup* (intended for the trajectory points field)
 * @param namespace - The namespace for the tracks, used to get the correct interpolator
 * @param animationDuration - The duration of the animation
 * @param currentStamp - The current timestamp
 * @param speed - The speed of playback
 * @param direction - The direction of playback
 * @returns
 */
export function computeTrackTrajectories(
  tracks: Record<string, Track<RawValue>>,
  trackInterpolators: TrackInterpolators,
  namespace: string,
  animationDuration: number,
  currentStamp: number,
  speed: number,
  direction: PlayerDirection,
): TrajectoryMessage {
  const trackNames = Object.keys(tracks);

  const frames: InstancedFrameInfo[] = computeFrames(tracks);
  const points: TrajectoryPointArray = frames.map((frame) => {
    const p: PositionAndVelocityTrajectoryPoint = {
      positions: [],
      velocities: [],
      timeFromStart: (frame.stamp * animationDuration) / 1000,
    };
    trackNames.forEach((trackName) => {
      const track = tracks[trackName];
      const lookup = getLookup(namespace, track.animatableId);
      const interpolator = trackInterpolators[lookup];
      if (!interpolator) {
        throw new Error(`Interpolator not found for track: ${trackName}`);
      }
      p.positions.push(interpolator.value(frame.stamp)!);
      p.velocities.push(interpolator.derivative(frame.stamp)!);
    });
    return p;
  });

  const basicTrajectoryMessage: TrajectoryMessage = {
    jointNames: trackNames,
    points,
  };

  // Rebase and reorient the trajectory message based on the current stamp, speed, and direction
  return rebaseAndReorientTrajectoryMessage(
    basicTrajectoryMessage,
    (currentStamp * animationDuration) / 1000,
    speed,
    direction,
  );
}

/**
 * Rebase and reorient a trajectory message based on the current time, speed, and playback direction.
 * @param trajectoryMessage - The trajectory message to rebase and reorient.
 * @param currentTime - The current timestamp in seconds.
 * @param speed - The speed of playback (always positive).
 * @param direction - The direction of playback (forward or backward).
 * @returns A new trajectory message with rebased and reoriented points. All points less than or equal to the current time are removed.
 */
function rebaseAndReorientTrajectoryMessage(
  trajectoryMessage: TrajectoryMessage,
  currentTime: number,
  speed: number,
  direction: PlayerDirection,
): TrajectoryMessage {
  // This function would rebase the trajectory message based on the current stamp and speed.
  // It would also reorient the trajectory points based on the playback direction.
  const newTrajectory: TrajectoryMessage = {
    jointNames: trajectoryMessage.jointNames,
    points: [],
  };
  trajectoryMessage.points.forEach((point) => {
    const newPoint = {
      positions: point.positions, // Positions remain unchanged
      velocities: (point as PositionAndVelocityTrajectoryPoint).velocities?.map((v) =>
        rawValueMultiplyScalar(v, speed),
      ), // Rebase velocities
      // For now we don't rebase accelerations or effort values, as they are not used in the current implementation
      accelerations: (point as PositionVelocityAndAccelerationTrajectoryPoint).accelerations,
      effort: (point as PositionAndEffortTrajectoryPoint).effort,
      timeFromStart:
        direction === PlayerDirection.Forward
          ? (point.timeFromStart - currentTime) / speed
          : (currentTime - point.timeFromStart) / speed, // Reorient timeFromStart based on direction
    };
    if (newPoint.timeFromStart > 0) {
      newTrajectory.points.push(newPoint);
    }
  });

  if (direction === PlayerDirection.Reverse) {
    // If the direction is reverse, we need to reverse the order of the points
    newTrajectory.points.reverse();
  }

  return newTrajectory;
}
