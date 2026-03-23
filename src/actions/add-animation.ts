import { RawValue } from "@semio/utils";
import { AnimationData } from "../store-types";
import { StoredAnimation, Track } from "../types";
import type { SimpleTrack } from "../types/data/simple-track";
import { migrateToMillisecondStamps } from "../functions/migrate-animation-format";

/**
 * Adds an animation to the state.
 *
 * This function takes the provided animation data,
 * and updates the state with the new animation and its tracks. If the animation ID is
 * not provided, it uses the active animation ID from the state. The function also
 * ensures that the animation is added to the list of visualized animations and sets
 * it as the active animation.
 *
 * Legacy v1 animations (normalized [0,1] stamps) are automatically migrated to v2
 * (millisecond stamps) on load via migrateToMillisecondStamps.
 *
 * @param state - The current state of the animation data.
 * @param animationData - The data of the animation to be added. It should be an object
 *                        containing the animation details.
 */
export function addAnimation(state: AnimationData, animationData: StoredAnimation) {
  if (animationData && typeof animationData === "object") {
    // Migrate legacy v1 format to v2 (millisecond stamps) on load
    const migrated = migrateToMillisecondStamps(animationData);
    const animationId = migrated.id;
    const animation = {
      id: migrated.id,
      name: migrated.name,
      tracks: migrated.tracks.map((t) => t.id),
      groups: migrated.groups,
      duration: migrated.duration,
    };
    const tracks = migrated.tracks.reduce((acc, track) => ({ ...acc, [track.id]: track }), {});

    Object.values(tracks as Record<string, Track<RawValue>>).forEach((track: Track<RawValue>) => {
      const trackColor = track.settings?.color;
      if (trackColor && track.animatableId && state.animatables[track.animatableId]?.pub) {
        // Update the color for the animatable if necessary
        state.animatables[track.animatableId].pub!.color = trackColor;
      }
    });

    state.animations = {
      ...state.animations,
      [animationId]: {
        ...animation,
      },
    };
    state.tracks = { ...state.tracks, ...tracks } as Record<string, SimpleTrack>;
  }
}
