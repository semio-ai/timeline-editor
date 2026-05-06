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
  // Bail if the track is not actually a member of this animation. Without
  // this guard, calling with the wrong animationId would still strip the
  // entry from `state.tracks` and orphan it from its real owner.
  const animation = state.animations[animationId];
  if (!animation || !animation.tracks.includes(trackId)) return;

  animation.tracks = animation.tracks.filter((track) => track !== trackId);
  if (trackId in state.tracks) {
    state.tracks = omit(state.tracks, trackId);
  }
  // Drop selection entries for the removed track. `keypoints` is the
  // authoritative selection store; leaving an entry under a deleted trackId
  // would leak orphans into selection-driven actions (cut/copy/delete).
  if (state.selectionState.keypoints.has(trackId)) {
    state.selectionState.keypoints.delete(trackId);
  }
}
