import type { AnimationData } from "../store-types";
import { Track } from "../types";

export function createTrack(
  state: AnimationData,
  animationId: string,
  track: Partial<Track>,
): Track {
  const id = crypto.randomUUID();
  const newTrack: Track = {
    id,
    name: "New Track",
    points: [],
    ...track,
  };
  state.animations[animationId].tracks.set(newTrack.id, newTrack);
  state.animations[animationId].trackOrder.push(newTrack.id);
  return newTrack;
}
