import type { AnimationData } from "../store-types";
import type { SimpleTrack } from "../types/data/simple-track";
import { COMPLEX_TYPES } from "../constants";

/**
 * Creates a new track and adds it to the specified animation.
 *
 * @param state - The current animation data state.
 * @param animatableId - The id of the animatable value to pair to
 * @param animationId - The ID of the animation to which the track will be added.
 * @param track - Partial track data to initialize the new track.
 * @returns The newly created track.
 */
export function createTrack(
  state: AnimationData,
  animatableId: string,
  animationId: string,
  track: Partial<SimpleTrack>,
): SimpleTrack {
  const animatable = state.animatables[animatableId];
  if (animatable && COMPLEX_TYPES.has(animatable.type)) {
    throw new Error(
      `createTrack only supports scalar animatables. Received composite type "${animatable.type}".`,
    );
  }
  const groupAxis = animatable?.group?.axis;
  const groupName = animatable?.name;
  const id = crypto.randomUUID();
  const newTrack: SimpleTrack = {
    id,
    name: track.name ?? groupAxis ?? groupName ?? "New Track",
    points: [],
    animatableId,
    groupName: track.groupName ?? (groupAxis ? groupName : undefined),
    ...track,
  };
  state.tracks[id] = newTrack;
  state.animations[animationId].tracks.push(id); // is tracks defined here?
  return newTrack;
}
