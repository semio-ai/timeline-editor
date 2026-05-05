import { usePlayerStore } from "@semio/utils";
import type { AnimationData } from "../store-types";
import {
  findInsertionNeighbors,
  resolveNewKeyTransitionPreferences,
  resolveNewKeyTransitions,
} from "../functions/resolve-new-key-transitions";
import type { SimpleKeypoint, SimpleRawValue } from "../types/data/simple-track";

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
  point: Partial<SimpleKeypoint>,
): SimpleKeypoint {
  const track = state.tracks[trackId];
  if (!track) {
    throw new Error(`Track ${trackId} not found when creating keypoint.`);
  }

  const id = point.id ?? crypto.randomUUID();
  const existingPoint = track.points.find((p) => p.id === id);
  if (existingPoint) {
    const nextPoint = { ...existingPoint, ...point } as SimpleKeypoint;
    track.points = track.points.map((p) => (p.id === id ? nextPoint : p));
    return nextPoint;
  } else {
    const fallbackValue: SimpleRawValue =
      point.value ?? (typeof track.points[0]?.value !== "undefined" ? track.points[0].value : 0);
    const stamp = point.stamp ?? usePlayerStore.getState().player.stamp;
    // Honor caller-provided transitions (e.g. clipboard paste with full
    // keypoint shape); otherwise apply the user's configured new-key
    // defaults so all keypoint-creation paths agree on what "new key"
    // means.
    const transitions =
      point.transitions ??
      resolveNewKeyTransitions({
        ...findInsertionNeighbors(
          track.points.slice().sort((a, b) => a.stamp - b.stamp),
          stamp,
        ),
        anchor: { stamp, value: fallbackValue },
        defaults: resolveNewKeyTransitionPreferences(state),
      });
    const newPoint: SimpleKeypoint = {
      id,
      stamp,
      value: fallbackValue,
      transitions,
    };
    track.points = [...track.points, newPoint].toSorted((a, b) => a.stamp - b.stamp);
    return newPoint;
  }
}
