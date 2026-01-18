import { usePlayerStore } from "@semio/utils";
import type { AnimationData } from "../store-types";
import { Keypoint } from "../types";
import { computeTrackInterpolator } from "../functions";
import type { SimpleKeypoint, SimpleRawValue } from "../types/data/simple-track";

export interface KeypointDelta<T extends SimpleRawValue>
  extends Omit<Keypoint<T>, "stamp" | "value"> {
  stamp: number | ((current: number) => number);
  value: T | ((current: T) => T);
}

/**
 * Updates or adds a keypoint in the specified track within the animation state.
 *
 * @param state - The current animation data state.
 * @param trackId - The ID of the track to update.
 * @param keypoint - The keypoint data to update or add. If updating, it should match by id or stamp (which can only match via a non-delta update).
 * @returns The updated or newly added keypoint, or undefined if the track does not exist.
 */
export function updateKeypoint(
  state: AnimationData,
  trackId: string,
  keypoint: Partial<SimpleKeypoint> | KeypointDelta<SimpleRawValue>,
  _matchSlopeWhenInserting = true,
): SimpleKeypoint | undefined {
  const track = state.tracks[trackId];
  if (!track) {
    return;
  }
  const points = track.points;
  const existingPoints = points.filter(
    (point) => point.id === keypoint.id || point.stamp === keypoint.stamp,
  );
  if (existingPoints.length === 1) {
    const existingPoint = existingPoints[0];
    const updatedPoint = getUpdatedPoint(existingPoint, keypoint);
    // Remove any points already present that have the same stamp or id
    const newPoints = points.filter(
      (p) => p.id !== existingPoint.id || p.stamp !== existingPoint.stamp,
    );
    state.tracks[trackId].points = [...newPoints, updatedPoint];
    return updatedPoint;
  } else if (existingPoints.length > 1) {
    // Check to see if there is only one point with the same id, versus matching by stamp.
    const idMatches = existingPoints.filter((p) => p.id === keypoint.id);
    if (idMatches.length === 1) {
      // Update the existing point (based on id), and then clear out any other points with the same stamp/id
      const updatedPoint = getUpdatedPoint(idMatches[0], keypoint);
      const newPoints = points.filter(
        (p) => p.id !== updatedPoint.id || p.stamp !== updatedPoint.stamp,
      );
      state.tracks[trackId].points = [...newPoints, updatedPoint];
      return updatedPoint;
    }
    // If there are multiple id matches, then we are probably in some erroroneous state.
    // We should pick the first id match and update it, then clear out any other points with the same stamp/id;
    // First, log a warning message to indicate the issue
    console.warn(
      `Multiple points with the same id (${idMatches[0].id}) found. Updating the first one.`,
    );
    const updatedPoint = getUpdatedPoint(idMatches[0], keypoint);
    const newPoints = points.filter(
      (p) => p.id !== updatedPoint.id || p.stamp !== updatedPoint.stamp,
    );
    state.tracks[trackId].points = [...newPoints, updatedPoint];
    return updatedPoint;
  } else if (keypoint.value !== undefined || existingPoints.length === 0) {
    // We need to insert a new point because one does not yet exist
    if (track.points.length === 0) {
      // If the track is empty, we should insert a point at the default value for the animatable value;
      // By definition, this overrides the `matchSlopeWhenInserting` field because the new slope will always be 0.
      const defaultValue = state.animatables[track.animatableId]?.default;
      if (defaultValue !== undefined) {
        const newPoint: SimpleKeypoint = {
          id: crypto.randomUUID(),
          stamp: usePlayerStore.getState().player.stamp,
          value: defaultValue as SimpleRawValue,
        };
        track.points.push(newPoint);
      }
    } else {
      // We need to insert a new point somewhere in the track.
      // TODO: To do this, we need to use a splitting algorithm to compute a new set
      // of points for the track that maintains the overall shape of the track.
      // However, for now we will just insert a point at the specified or default value,
      // using the default easing method.
    }
    let stamp = usePlayerStore.getState().player.stamp;
    if (typeof keypoint.stamp === "number") {
      stamp = keypoint.stamp;
    } else if (typeof keypoint.stamp === "function") {
      stamp = keypoint.stamp(stamp);
    }
    const newPoint: SimpleKeypoint = {
      id: crypto.randomUUID(),
      stamp,
      value: state.animatables[track.animatableId]?.default as SimpleRawValue,
    };

    if (typeof keypoint.value === "function") {
      // We need to lookup the current value
      const interpolator = computeTrackInterpolator(track, {
        id: "default",
        animationId: "default",
        settings: { offset: 0, timescale: 1, active: true },
      });
      const interpolatedValue = interpolator(stamp) as SimpleRawValue | undefined;
      if (interpolatedValue === undefined) {
        newPoint.value = state.animatables[track.animatableId]?.default as SimpleRawValue;
      } else {
        newPoint.value = keypoint.value(interpolatedValue);
      }
    } else if (keypoint.value !== undefined) {
      newPoint.value = keypoint.value;
    }

    const index = points.findIndex((point) => point.stamp > newPoint.stamp);
    if (index === -1) {
      points.push(newPoint);
    } else {
      points.splice(index, 0, newPoint);
    }
    state.tracks[trackId].points = points;
    return newPoint;
  }
}

function getUpdatedPoint(
  existingPoint: SimpleKeypoint,
  update: Partial<SimpleKeypoint> | KeypointDelta<SimpleRawValue>,
): SimpleKeypoint {
  let stamp = existingPoint.stamp;
  let value = existingPoint.value;
  if (update.stamp !== undefined && typeof update.stamp !== "function") {
    stamp = update.stamp;
  } else if (update.stamp !== undefined && typeof update.stamp === "function") {
    stamp = update.stamp(existingPoint.stamp);
  }
  if (update.value !== undefined && typeof update.value !== "function") {
    value = update.value;
  } else if (update.value !== undefined && typeof update.value === "function") {
    value = update.value(existingPoint.value);
  }
  const cleanUpdate: Partial<SimpleKeypoint> = { ...update, stamp, value };
  const updatedPoint: SimpleKeypoint = { ...existingPoint, ...cleanUpdate };
  return updatedPoint;
}
