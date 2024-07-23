import type { AnimationData } from "../store-types";
import type { Track } from "../types";

export function updateTrack(
  state: AnimationData,
  animationId: string,
  trackId: string,
  data: Omit<Track, "id" | "points">,
) {
  const track = state.animations[animationId].tracks.get(trackId);
  if (track) {
    state.animations[animationId].tracks.set(trackId, { ...track, ...data });
  }
}
