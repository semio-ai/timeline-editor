import { RawValue } from "@semio/utils";
import type { Animation, StoredAnimation, Track } from "../types";

/**
 * Computes a stored animation object from the given animation and tracks.
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
    tracks: animation.tracks.map((t) => tracks[t]),
    groups: animation.groups,
    transitions: animation.transitions,
    duration: animation.duration,
    instances: animation.instances,
  };
}
