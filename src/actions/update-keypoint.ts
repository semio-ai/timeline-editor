import { RawValue, usePlayerStore } from "@semio/utils";
import type { AnimationData } from "../store-types";
import { Keypoint } from "../types";

export function updateKeypoint(
  state: AnimationData,
  trackId: string,
  keypoint: Partial<Keypoint<RawValue>>,
): Keypoint<RawValue> | undefined {
  const track = state.tracks[trackId];
  if (!track) {
    return;
  }
  // Match by id or stamp
  const existingPoint = state.tracks[trackId].points.find(
    (point) => point.id === keypoint.id || point.stamp === keypoint.stamp,
  );
  if (existingPoint) {
    state.tracks[trackId].points = track.points
      .map((point) => (point.id === existingPoint.id ? { ...existingPoint, ...keypoint } : point))
      .toSorted((a, b) => a.stamp - b.stamp);
    return state.tracks[trackId].points.find((point) => point.id === existingPoint.id);
  } else if (keypoint.value) {
    const newPoint = {
      id: crypto.randomUUID(),
      stamp: usePlayerStore.getState().player.stamp,
      ...keypoint,
    } as Keypoint<RawValue>;
    state.tracks[trackId].points = [...state.tracks[trackId].points, newPoint].toSorted(
      (a, b) => a.stamp - b.stamp,
    );
    return newPoint;
  }
}
