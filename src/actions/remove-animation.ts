import { omit } from "lodash";
import { AnimationData } from "../store-types";

/**
 * Removes an animation from the state by its ID.
 *
 * If the animation to be removed is the active animation,
 * it updates the active animation to the next available one
 * in the visualized animations list or the animations list.
 * If no animations are left, it creates and adds a default animation.
 *
 * @param state - The current state of animations.
 * @param animationId - The ID of the animation to be removed.
 */
export function removeAnimation(state: AnimationData, animationId: string, removeTracks = true) {
  if (animationId in state.animations) {
    const { [animationId]: animation, ...newAnimations } = state.animations;
    state.animations = newAnimations;
    let mutatedTracks = false;
    // Remove the tracks for that animation
    animation.tracks.forEach((trackId) => {
      if (removeTracks) {
        console.log("removing track", trackId);
        state.tracks = omit(state.tracks, [trackId]);
        mutatedTracks = true;
      }
    });
    // See add-animation.ts for the tracksRevision rationale.
    if (mutatedTracks) {
      state.tracksRevision = (state.tracksRevision ?? 0) + 1;
    }
  }
}
