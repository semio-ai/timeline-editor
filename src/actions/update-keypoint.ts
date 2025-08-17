import { RawValue, usePlayerStore } from "@semio/utils";
import type { AnimationData } from "../store-types";
import { Keypoint } from "../types";

/**
 * Updates or adds a keypoint in the specified track within the animation state.
 *
 * @param state - The current animation data state.
 * @param trackId - The ID of the track to update.
 * @param keypoint - The keypoint data to update or add. If updating, it should match by id or stamp.
 * @param canMerge - If true, allows merging of keypoints with the same stamp. Defaults to true.
 * @returns The updated or newly added keypoint, or undefined if the track does not exist.
 */
export function updateKeypoint(
  state: AnimationData,
  trackId: string,
  keypoint: Partial<Keypoint<RawValue>>,
  canMerge = true,
): Keypoint<RawValue> | undefined {
  const track = state.tracks[trackId];
  if (!track) {
    return;
  }
  // Match by id or stamp (if canMerge)
  const points = track.points;
  const existingPoints = points.filter(
    (point) => point.id === keypoint.id || (canMerge && point.stamp === keypoint.stamp),
  );
  if (existingPoints.length === 1) {
    const existingPoint = existingPoints[0];
    if (existingPoint.id === keypoint.id) {
      Object.assign(existingPoint, keypoint);
    } else {
      // We have to remove the existing point and add a new merged one.
      const merged = { ...existingPoint, ...keypoint };
      const filteredPoints = points.filter((p) => p.id !== existingPoint.id);
      const index = filteredPoints.findIndex((point) => point.stamp > merged.stamp);
      if (index === -1) {
        filteredPoints.push(merged as Keypoint<RawValue>);
      } else {
        filteredPoints.splice(index, 0, merged as Keypoint<RawValue>);
      }
      state.tracks[trackId].points = filteredPoints;
    }

    return existingPoint as Keypoint<RawValue>;
  } else if (existingPoints.length > 1) {
    // If there are multiple points with the same id or stamp, we should only merge the one
    // with the same id, unless canMerge is true, in which case we should merge all of them.
    const aggregatedPoint: Keypoint<RawValue> = [...existingPoints, keypoint].reduce(
      (acc, kp) => ({ ...acc, ...kp }),
      { ...existingPoints[0], id: keypoint.id },
    ) as Keypoint<RawValue>;
    const newPoints = points.filter((p) => !existingPoints.includes(p));
    const index = points.findIndex((point) => point.stamp > aggregatedPoint.stamp);
    if (index === -1) {
      newPoints.push(aggregatedPoint);
    } else {
      newPoints.splice(index, 0, aggregatedPoint);
    }
    state.tracks[trackId].points = newPoints;
    return aggregatedPoint;
  } else if (keypoint.value !== undefined) {
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
    state.tracks[trackId].points = points;
    return newPoint;
  }
}
