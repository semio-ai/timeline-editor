import { DEFAULT_ANIMATION_ID } from "../constants";
import type { StoredAnimation } from "../types";
import { CURRENT_ANIMATION_FORMAT_VERSION } from "../types/data/animation";

/**
 * Creates a default animation in v2 format (millisecond stamps).
 *
 * @returns - A new empty animation with 5000ms duration
 */
export function createDefaultAnimation(): StoredAnimation {
  return {
    id: DEFAULT_ANIMATION_ID,
    name: "New Animation",
    tracks: [],
    groups: [],
    duration: 5000,
    formatVersion: CURRENT_ANIMATION_FORMAT_VERSION,
  };
}
