import { omit } from "lodash";
import type { AnimationData } from "../store-types";

export function removeTrack(state: AnimationData, animationId: string, trackId: string) {
  state.animations[animationId].tracks = state.animations[animationId].tracks.filter(
    (track) => track !== trackId,
  );
  if (trackId in state.tracks) {
    state.tracks = omit(state.tracks, trackId);
  }
}
