import { RawValue } from "@semio/utils";
import { AnimationData } from "../store-types";
import { Track } from "../types";
import type { SimpleTrack } from "../types/data/simple-track";
import { readStoredAnimation, splitCompositeTracks } from "../functions/stored-animation-format";

/**
 * Adds an animation to the state.
 *
 * This function takes the provided animation data,
 * and updates the state with the new animation and its tracks. If the animation ID is
 * not provided, it uses the active animation ID from the state. The function also
 * ensures that the animation is added to the list of visualized animations and sets
 * it as the active animation.
 *
 * Persisted formats 1, 2 and 3 are read into millisecond tracks by readStoredAnimation,
 * and a legacy track of composite values is split into scalar tracks
 * (splitCompositeTracks), so every track the store holds can be written as format 3.
 *
 * @param state - The current state of the animation data.
 * @param animationData - The data of the animation to be added. It should be an object
 *                        containing the animation details.
 */
export function addAnimation(state: AnimationData, animationData: unknown) {
  if (animationData && typeof animationData === "object") {
    // Resolve time units before the store or its subscriptions inspect tracks.
    const migrated = splitCompositeTracks(readStoredAnimation(animationData));
    const animationId = migrated.id;
    const animation = {
      id: migrated.id,
      name: migrated.name,
      tracks: migrated.tracks.map((t) => t.id),
      groups: migrated.groups,
      defaultViewportExtent: migrated.defaultViewportExtent ?? migrated.duration,
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
    // Mirror the user-edit paths in `AnimationSlice` (e.g. updateTrack,
    // createTrack) — any mutation of `state.tracks` must bump tracksRevision so
    // `updateInstancedTrackSources` re-derives. Server-pushed asset updates
    // historically skipped this, leaving the instanced source map stale.
    state.tracksRevision = (state.tracksRevision ?? 0) + 1;
  }
}
