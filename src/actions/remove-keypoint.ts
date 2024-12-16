import type { AnimationData } from "../store-types";

/**
 * Removes a keypoint from a specified track in the animation data.
 *
 * @param state - The current animation data state.
 * @param trackId - The ID of the track from which the keypoint should be removed.
 * @param keypointId - The ID of the keypoint to be removed.
 */
export function removeKeypoint(state: AnimationData, trackId: string, keypointId: string) {
  const track = state.tracks[trackId];
  if (!track) {
    return;
  }
  state.tracks[trackId].points = track.points.filter((point) => point.id !== keypointId);
}
