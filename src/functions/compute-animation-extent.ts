import type { RawValue } from "@semio/utils";
import type { Animation, StoredAnimation } from "../types/data/animation";
import type { Track } from "../types/data/track";
import { assertReadableAnimationFormat } from "./migrate-animation-format";

/**
 * Computes the actual extent (duration) of an animation from its track content.
 * Returns the maximum keypoint stamp across all tracks, or 0 if no keypoints exist.
 *
 * This is the authoritative duration in v2 format — it replaces the legacy
 * `animation.duration` field which was an explicit property in v1.
 *
 * @param tracks - Track data (either embedded tracks from StoredAnimation or
 *   resolved tracks from the track map)
 * @returns Duration in milliseconds derived from the furthest keypoint
 */
export function computeTrackExtent(tracks: Track<RawValue>[]): number {
  let maxStamp = 0;
  for (const track of tracks) {
    for (const point of track.points) {
      if (point.stamp > maxStamp) {
        maxStamp = point.stamp;
      }
    }
  }
  return maxStamp;
}

/**
 * Resolves the effective duration of an animation, considering both the
 * track content extent and the optional defaultViewportExtent.
 *
 * The effective duration is the maximum of:
 * - The actual content extent (derived from keypoint stamps)
 * - The defaultViewportExtent (if set)
 * - A minimum floor of 1000ms (prevents zero-duration edge cases)
 *
 * @param animation - The runtime animation (with track IDs)
 * @param tracks - The track map to resolve track data from
 * @returns Effective duration in milliseconds
 */
export function resolveAnimationDuration(
  animation: Animation,
  tracks: Record<string, Track<RawValue>>,
): number {
  const resolvedTracks = animation.tracks
    .map((id) => tracks[id])
    .filter((t): t is Track<RawValue> => t != null);
  const contentExtent = computeTrackExtent(resolvedTracks);
  const viewportExtent = animation.defaultViewportExtent ?? 0;
  return Math.max(contentExtent, viewportExtent, 1000);
}

/**
 * Resolves the effective duration from a StoredAnimation (embedded tracks).
 */
export function resolveStoredAnimationDuration(stored: StoredAnimation): number {
  assertReadableAnimationFormat(stored);
  const contentExtent = computeTrackExtent(stored.tracks);
  const viewportExtent = stored.defaultViewportExtent ?? stored.duration ?? 0;
  return Math.max(contentExtent, viewportExtent, 1000);
}
