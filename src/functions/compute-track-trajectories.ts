import { PlayerDirection, RawValue } from "@semio/utils";
import { AnimationInstanceSettings, Track } from "../types";
import { TrackTrajectory } from "../types/data/track-trajectory";

/**
 *
 * @param tracks - The set of tracks indexed by their *name* (intended for the trajectory jointNames field)
 * @param animationInstanceSettings - The settings for the animation instance
 * @param animationDuration - The duration of the animation
 * @param currentStamp - The current timestamp
 * @param speed - The speed of playback
 * @param direction - The direction of playback
 * @returns
 */
export function computeTrackTrajectories(
  tracks: Record<string, Track<RawValue>>,
  animationInstanceSettings: AnimationInstanceSettings,
  animationDuration: number,
  currentStamp: number,
  speed: number,
  direction: PlayerDirection,
): TrackTrajectory {
  const trackNames = Object.keys(tracks);

  return {
    jointNames: trackNames,
    jointAngles: [],
    times: [],
  };
}
