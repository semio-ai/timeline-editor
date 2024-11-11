import { RawValue } from "@semio/utils";
import type { AnimationData } from "../store-types";
import { Track } from "../types";

/**
 * Creates a new track and adds it to the specified animation.
 *
 * @param state - The current animation data state.
 * @param animationId - The ID of the animation to which the track will be added.
 * @param track - Partial track data to initialize the new track.
 * @returns The newly created track.
 */
export function createTrack(
  state: AnimationData,
  animationId: string,
  track: Partial<Track<RawValue>>,
): Track<RawValue> {
  const id = crypto.randomUUID();
  const newTrack: Track<RawValue> = {
    id,
    name: "New Track",
    points: [],
    ...track,
  };
  state.tracks[id] = newTrack;
  state.animations[animationId].tracks.push(id);
  return newTrack;
}
