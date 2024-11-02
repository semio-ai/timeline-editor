import { RawValue } from "@semio/utils";
import type { Animation, StoredAnimation, Track } from "../types";

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
