import type { AnimationData } from "../store-types";

export function removeKeypoint(state: AnimationData, trackId: string, keypointId: string) {
  const track = state.tracks[trackId];
  if (!track) {
    return;
  }
  state.tracks[trackId].points = track.points.filter((point) => point.id !== keypointId);
}
