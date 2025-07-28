import { uniq } from "lodash";
import { RawValue } from "@semio/utils";
import type { Track, AnimationInstance } from "../types";
import { computeWorldStamp } from "./compute-instance-time";

/**
 * Computes a sorted array of unique timestamps (stamps) based on the provided tracks and instances.
 *
 * @param tracks - A record of track objects, where each track contains points with stamps.
 * @param instances - A record of instance information objects.
 * @returns An array of unique timestamps sorted in ascending order.
 */
export function computeStamps(
  tracks: Record<string, Track<RawValue>>,
  instances: Record<string, AnimationInstance>,
): number[] {
  // Guard against null/undefined inputs during initialization
  if (!tracks || !instances) {
    return [];
  }

  const stamps: number[] = [];
  Object.values(instances).forEach((instanceInfo) => {
    Object.values(tracks).forEach((track) => {
      track.points.forEach((point) => {
        stamps.push(
          computeWorldStamp(
            point.stamp,
            instanceInfo.settings.timescale,
            instanceInfo.settings.offset,
          ),
        );
      });
    });
  });
  return uniq(stamps.sort((a, b) => a - b));
}
