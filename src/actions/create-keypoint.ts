import { RawValue } from "@semio/utils";
import type { AnimationData } from "../store-types";
import { Keypoint } from "../types";

export function createKeypoint(
  state: AnimationData,
  trackId: string,
  point: Partial<Keypoint<RawValue>>,
): Keypoint<RawValue> {
  const id = crypto.randomUUID();
  const existingPoint = state.tracks[trackId].points.find((p) => p.id === point.id);
  if (existingPoint) {
    state.tracks[trackId].points = state.tracks[trackId].points.map((p) =>
      p.id === id ? { ...p, ...point } : p,
    );
    return existingPoint;
  } else {
    const newPoint = {
      id,
      stamp: point.stamp ?? state.player.stamp,
      value: point.value,
    } as Keypoint<RawValue>;
    state.tracks[trackId].points = [...state.tracks[trackId].points, newPoint].toSorted(
      (a, b) => a.stamp - b.stamp,
    );
    return newPoint;
  }
}
