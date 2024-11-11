import { omit } from "lodash";
import type { AnimationData } from "../store-types";

/**
 * Removes a track from the specified animation and the global tracks list.
 *
 * @param state - The current animation state.
 * @param animationId - The ID of the animation from which the track will be removed.
 * @param trackId - The ID of the track to be removed.
 */
export function removeTrack(state: AnimationData, animationId: string, trackId: string) {
  state.animations[animationId].tracks = state.animations[animationId].tracks.filter(
    (track) => track !== trackId,
  );
  if (trackId in state.tracks) {
    state.tracks = omit(state.tracks, trackId);
  }
}
