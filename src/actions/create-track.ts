import { RawValue } from "@semio/utils";
import type { AnimationData } from "../store-types";
import { Track } from "../types";

export function createTrack(
  state: AnimationData,
  animationId: string,
  track: Partial<Track<RawValue>>,
): Track<RawValue> {
  const id = crypto.randomUUID();
  const newTrack: Track<RawValue> = {
    id,
    name: "New Track",
    points: [],
    ...track,
  };
  state.tracks[id] = newTrack;
  state.animations[animationId].tracks.push(id);
  return newTrack;
}
