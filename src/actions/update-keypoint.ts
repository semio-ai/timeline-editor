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
  const points = track.points;
  const existingPoint = points.find(
    (point) => point.id === keypoint.id || point.stamp === keypoint.stamp,
  );
  if (existingPoint) {
    Object.assign(existingPoint, keypoint);
    return existingPoint as Keypoint<RawValue>;
  } else if (keypoint.value) {
    const newPoint = {
      id: crypto.randomUUID(),
      stamp: usePlayerStore.getState().player.stamp,
      ...keypoint,
    } as Keypoint<RawValue>;

    const index = points.findIndex((point) => point.stamp > newPoint.stamp);
    if (index === -1) {
      points.push(newPoint);
    } else {
      points.splice(index, 0, newPoint);
    }
    return newPoint;
  }
}
