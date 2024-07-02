import type { AnimationData } from "../store-types";
import { Track } from "../types";

export function createTrack(
  state: AnimationData,
  animationId: string,
  track: Partial<Track>,
) {
  const id = crypto.randomUUID();
  state.animations[animationId].tracks.set(id, {
    name: "New Track",
    points: [],
    ...track,
    id,
  });
  state.animations[animationId].trackOrder.push(id);
}
