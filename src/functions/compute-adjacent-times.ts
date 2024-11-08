import { RawValue } from "@semio/utils";
import type { Track, InstanceInfo } from "../types";
import { computeStamps } from "./compute-stamps";

/**
 * Computes the next timestamp based on the provided tracks, instances, and current timestamp.
 *
 * @param tracks - A record of track objects, where each key is a string identifier and the value is a Track of RawValue.
 * @param instances - A record of instance information, where each key is a string identifier and the value is an InstanceInfo object.
 * @param stamp - The current timestamp from which to compute the next timestamp.
 * @param bounds - A tuple representing the lower and upper bounds for the timestamps.
 * @param respectBounds - A boolean indicating whether to respect the upper bound when computing the next timestamp.
 * @returns The next timestamp if found, otherwise undefined.
 */
export function computeNextTime(
  tracks: Record<string, Track<RawValue>>,
  instances: Record<string, InstanceInfo>,
  stamp: number,
  bounds: [number, number],
  respectBounds: boolean,
): number | undefined {
  const allStamps = computeStamps(tracks, instances);
  const nextStamp = respectBounds
    ? allStamps.find((s) => s > stamp && s <= bounds[1])
    : allStamps.find((s) => s > stamp);
  return nextStamp;
}

/**
 * Computes the previous timestamp from a given stamp within the provided tracks and instances.
 *
 * @param tracks - A record of track objects, where each key is a string identifier and the value is a Track of RawValue.
 * @param instances - A record of instance information, where each key is a string identifier and the value is an InstanceInfo object.
 * @param stamp - The current timestamp from which to compute the previous time.
 * @param bounds - A tuple representing the lower and upper bounds within which the previous timestamp should be found.
 * @param respectBounds - A boolean indicating whether to respect the bounds when finding the previous timestamp.
 * @returns The previous timestamp if found, otherwise undefined.
 */
export function computePreviousTime(
  tracks: Record<string, Track<RawValue>>,
  instances: Record<string, InstanceInfo>,
  stamp: number,
  bounds: [number, number],
  respectBounds: boolean,
): number | undefined {
  const allStamps = computeStamps(tracks, instances);
  const nextStamp = respectBounds
    ? allStamps.reverse().find((s) => s < stamp && s >= bounds[0])
    : allStamps.reverse().find((s) => s < stamp);
  return nextStamp;
}
