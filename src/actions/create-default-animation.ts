import { DEFAULT_ANIMATION_ID } from "../constants";
import type { StoredAnimation } from "../types";

/**
 * Creates a default animation. This is a one-to-one mapping of joints to tracks.
 *
 * @returns - A set of tracks and a binding configuration
 */
export function createDefaultAnimation(): StoredAnimation {
  return {
    id: DEFAULT_ANIMATION_ID,
    name: "New Animation",
    tracks: [],
    groups: new Map(),
    transitions: new Map(),
    instances: {
      default: {
        animationInstanceId: "",
        animationId: DEFAULT_ANIMATION_ID,
        namespace: "default",
        settings: {
          active: true,
          offset: 0,
          timescale: 1,
        },
      },
    },
    duration: 5000,
  };
}
