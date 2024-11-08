import { RawValue, usePlayerStore } from "@semio/utils";
import type { AnimationData } from "../store-types";
import { Keypoint } from "../types";

/**
 * Creates a keypoint in the specified track of the animation state.
 *
 * If a keypoint with the same ID already exists, it updates the existing keypoint with the
 * provided properties. Otherwise, it creates a new keypoint with a
 * generated ID and the provided properties, and inserts it into the
 * track's points array in sorted order by stamp.
 *
 * @param state - The animation state containing tracks and keypoints.
 * @param trackId - The ID of the track where the keypoint should be created or updated.
 * @param point - The properties of the keypoint to create or update. If updating, the ID should match an existing keypoint.
 * @returns The created or updated keypoint.
 */
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
      stamp: point.stamp ?? usePlayerStore.getState().player.stamp,
      value: point.value,
    } as Keypoint<RawValue>;
    state.tracks[trackId].points = [...state.tracks[trackId].points, newPoint].toSorted(
      (a, b) => a.stamp - b.stamp,
    );
    return newPoint;
  }
}
