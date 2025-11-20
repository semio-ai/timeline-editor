import { RawValue } from "@semio/utils";
import { AnimationData } from "../store-types";
import { StoredAnimation, Track } from "../types";
import { normalizeTrackData } from "../functions/normalize-track-data";
import type { SimpleTrack } from "../types/data/simple-track";

/**
 * Adds an animation to the state.
 *
 * This function takes the provided animation data,
 * and updates the state with the new animation and its tracks. If the animation ID is
 * not provided, it uses the active animation ID from the state. The function also
 * ensures that the animation is added to the list of visualized animations and sets
 * it as the active animation.
 *
 * @param state - The current state of the animation data.
 * @param animationData - The data of the animation to be added. It should be an object
 *                        containing the animation details.
 */
export function addAnimation(state: AnimationData, animationData: StoredAnimation) {
  // console.log("Adding animation", animationData);
  if (animationData && typeof animationData === "object") {
    const animationId = (animationData as { id: string }).id;
    const animation = {
      id: animationData.id,
      name: animationData.name,
      tracks: animationData.tracks.map((t) => t.id),
      groups: animationData.groups,
      duration: animationData.duration,
    };
    const tracks = animationData.tracks.reduce((acc, track) => ({ ...acc, [track.id]: track }), {});

    Object.values(tracks as Record<string, Track<RawValue>>).forEach((track: Track<RawValue>) => {
      if (track.settings && track.animatableId && state.animatables[track.animatableId]?.pub) {
        // Update the color for the animatable if necessary
        state.animatables[track.animatableId].pub!.color = track.settings.color;
      }
    });

    const pendingAnimations = {
      ...state.animations,
      [animationId]: {
        ...animation,
      },
    };
    const pendingTracks = { ...state.tracks, ...tracks };

    const normalized = normalizeTrackData({
      tracks: pendingTracks as Record<string, Track<RawValue>>,
      animations: pendingAnimations,
      animatables: state.animatables,
    });

    state.animations = normalized.animations ?? pendingAnimations;
    state.tracks = (normalized.tracks as Record<string, SimpleTrack>) ?? state.tracks;
    state.animatables = normalized.animatables ?? state.animatables;
  }
}
