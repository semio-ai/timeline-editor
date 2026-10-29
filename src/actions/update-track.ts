import { RawValue } from "@semio/data";
import type { AnimationData } from "../store-types";
import type { Track } from "../types";

/**
 * Updates a specific track in the animation state with the provided partial track data.
 * If the track ID is present, it merges the existing track data with the new data.
 *
 * @param state - The current animation state containing all tracks.
 * @param track - A partial track object containing the properties to be updated.
 */
export function updateTrack(state: AnimationData, track: Partial<Track<RawValue>>) {
  if (track.id) {
    Object.assign(state.tracks[track.id], { ...state.tracks[track.id], ...track });
  }
}
