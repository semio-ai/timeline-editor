import { uniq } from "lodash";
import { RawValue } from "@semio/utils";
import type { Track, AnimationInstance, SourceRow } from "../types";
import { computeWorldStamp } from "./compute-instance-time";

/**
 * Computes a sorted array of unique timestamps (stamps) based on the provided tracks and instances.
 *
 * @param sources - An array of source objects representing the tracks to consider.
 * @param tracks - A record of track objects, where each track contains points with stamps.
 * @param instances - A record of instance information objects.
 * @returns An array of unique timestamps sorted in ascending order.
 */
export function computeStamps(
  source: SourceRow,
  tracks: Record<string, Track<RawValue>>,
  instances: Record<string, AnimationInstance>,
): number[] {
  // Guard against null/undefined inputs during initialization
  if (!tracks || !instances) {
    return [];
  }

  const stamps: number[] = [];
  source.tracks.forEach((trackData) => {
    const track = tracks[trackData.trackId];
    const instanceInfo = instances[source.namespaceId];
    if (!track || !instanceInfo) {
      console.warn(`Track or Instance Info not found, skipping`);
      return;
    }
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
  return uniq(stamps.sort((a, b) => a - b));
}
