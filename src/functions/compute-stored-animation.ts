import { RawValue } from "@semio/utils";
import type { Animation, StoredAnimation, Track } from "../types";
import { CURRENT_ANIMATION_FORMAT_VERSION } from "../types/data/animation";

/**
 * Computes a stored animation object from the given animation and tracks.
 * Always outputs in the current format version (v2 millisecond stamps).
 *
 * @param animation - The animation object containing details about the animation.
 * @param tracks - A record of track objects indexed by their string keys.
 * @returns The computed stored animation object.
 */
export function computeStoredAnimation(
  animation: Animation,
  tracks: Record<string, Track<RawValue>>,
): StoredAnimation {
  return {
    id: animation.id,
    name: animation.name,
    tracks: animation.tracks.map((t) => {
      const track = tracks[t];
      const { muted: _, ...rest } = track.settings || {};
      const settings = Object.keys(rest).length > 0 ? rest : undefined;
      return {
        ...track,
        settings,
      };
    }),
    groups: animation.groups,
    duration: animation.duration,
    formatVersion: CURRENT_ANIMATION_FORMAT_VERSION,
  };
}
