import { RawValue } from "@semio/utils";
import type { AnimationData } from "../store-types";
import type { Track } from "../types";

export function updateTrack(state: AnimationData, track: Partial<Track<RawValue>>) {
  if (track.id) {
    state.tracks = { ...state.tracks, [track.id]: { ...state.tracks[track.id], ...track } };
  }
}
