import { describe, it, expect, beforeEach } from "vitest";
import { RawValue } from "@semio/utils";
import { updateKeypoint } from "../actions/update-keypoint";
import { AnimationData } from "../store-types";
import { Track, Keypoint } from "../types";
import { createDefaultState } from "../actions";

describe("updateKeypoint", () => {
  let state: AnimationData;
  let trackId: string;

  beforeEach(() => {
    trackId = "test-track";
    state = {
      ...createDefaultState(),
      animations: {},
      tracks: {
        [trackId]: {
          id: trackId,
          name: "Test Track",
          animatableId: "test-animatable",
          points: [
            {
              id: "point-1",
              stamp: 0.25,
              value: 100,
              transitions: { out: { x: 0, y: 0 } },
            },
            {
              id: "point-2",
              stamp: 0.5,
              value: 200,
              transitions: { in: { x: 0.1, y: 1 }, out: { x: 0.8, y: 0.2 } },
            },
            {
              id: "point-3",
              stamp: 0.75,
              value: 300,
            },
          ],
        } as Track<RawValue>,
      },
      animatables: {},
      values: new Map(),
      velocities: new Map(),
      trackInterpolators: {},
      namespaceInfo: {},
    };
  });

  it("should update an existing keypoint when ID is provided", () => {
    const updatedValue = 150;
    updateKeypoint(state, trackId, {
      id: "point-1",
      value: updatedValue,
    });

    const track = state.tracks[trackId];
    expect(track.points).toHaveLength(3);
    expect(track.points[0].value).toBe(updatedValue);
    expect(track.points[0].id).toBe("point-1");
    expect(track.points[0].transitions).toEqual({ out: { x: 0, y: 0 } });
  });

  it("should update existing keypoint at same timestamp when ID matches", () => {
    const updatedValue = 250;
    updateKeypoint(state, trackId, {
      id: "point-2",
      stamp: 0.5,
      value: updatedValue,
    });

    const track = state.tracks[trackId];
    expect(track.points).toHaveLength(3);
    expect(track.points[1].value).toBe(updatedValue);
    expect(track.points[1].id).toBe("point-2");
    // Transitions should be preserved when updating by ID
    expect(track.points[1].transitions).toEqual({
      in: { x: 0.1, y: 1 },
      out: { x: 0.8, y: 0.2 },
    });
  });

  it("should merge with existing keypoint at same timestamp when no ID provided", () => {
    const updatedValue = 175;
    updateKeypoint(state, trackId, {
      stamp: 0.25,
      value: updatedValue,
    });

    const track = state.tracks[trackId];
    expect(track.points).toHaveLength(3);
    expect(track.points[0].value).toBe(updatedValue);
    // Original transitions should be preserved when merging
    expect(track.points[0].transitions).toEqual({ out: { x: 0, y: 0 } });
  });

  it("should create new keypoint when no matching timestamp exists", () => {
    const newValue = 400;
    const newStamp = 0.9;
    updateKeypoint(state, trackId, {
      stamp: newStamp,
      value: newValue,
    });

    const track = state.tracks[trackId];
    expect(track.points).toHaveLength(4);

    const newPoint = track.points.find((p) => p.stamp === newStamp);
    expect(newPoint).toBeDefined();
    expect(newPoint?.value).toBe(newValue);
    expect(newPoint?.id).toBeDefined();
  });

  it("should maintain sorted order when adding new keypoint", () => {
    const newValue = 150;
    const newStamp = 0.35;
    updateKeypoint(state, trackId, {
      stamp: newStamp,
      value: newValue,
    });

    const track = state.tracks[trackId];
    expect(track.points).toHaveLength(4);

    // Check that points are sorted by stamp
    for (let i = 1; i < track.points.length; i++) {
      expect(track.points[i].stamp).toBeGreaterThan(track.points[i - 1].stamp);
    }

    // Verify the new point is in the correct position
    expect(track.points[1].stamp).toBe(newStamp);
    expect(track.points[1].value).toBe(newValue);
  });

  it("should not create duplicate points when updating repeatedly at same timestamp", () => {
    const stamp = 0.25;

    // First update
    updateKeypoint(state, trackId, {
      stamp,
      value: 111,
    });

    // Second update at same timestamp
    updateKeypoint(state, trackId, {
      stamp,
      value: 222,
    });

    // Third update at same timestamp
    updateKeypoint(state, trackId, {
      stamp,
      value: 333,
    });

    const track = state.tracks[trackId];
    // Should still have only 3 points total
    expect(track.points).toHaveLength(3);

    // Check that there's only one point at the target timestamp
    const pointsAtStamp = track.points.filter((p) => p.stamp === stamp);
    expect(pointsAtStamp).toHaveLength(1);
    expect(pointsAtStamp[0].value).toBe(333);
  });

  it("should preserve transitions when updating by ID", () => {
    const transitions = { in: { x: 0.2, y: 0.8 }, out: { x: 0.5, y: 0.5 } };
    updateKeypoint(state, trackId, {
      id: "point-2",
      transitions,
    });

    const track = state.tracks[trackId];
    expect(track.points[1].transitions).toEqual(transitions);
  });

  it("should handle updating when canMerge is false", () => {
    const newValue = 150;
    // Update without merging - should only match by ID
    updateKeypoint(
      state,
      trackId,
      {
        stamp: 0.25,
        value: newValue,
      },
      false,
    );

    const track = state.tracks[trackId];
    // Since no ID was provided and canMerge is false, a new point should be created
    expect(track.points).toHaveLength(4);

    const pointsAtStamp = track.points.filter((p) => p.stamp === 0.25);
    expect(pointsAtStamp).toHaveLength(2);
  });

  it("should return undefined when track does not exist", () => {
    const result = updateKeypoint(state, "non-existent-track", {
      stamp: 0.5,
      value: 100,
    });

    expect(result).toBeUndefined();
  });

  it("should handle multiple points at same timestamp correctly", () => {
    // Add another point at the same timestamp as point-1
    state.tracks[trackId].points.push({
      id: "point-1-duplicate",
      stamp: 0.25,
      value: 999,
    } as Keypoint<RawValue>);

    // Update with ID should only update the matching point
    updateKeypoint(state, trackId, {
      id: "point-1",
      value: 777,
    });

    const track = state.tracks[trackId];
    const point1 = track.points.find((p) => p.id === "point-1");
    const pointDuplicate = track.points.find((p) => p.id === "point-1-duplicate");

    expect(point1?.value).toBe(777);
    expect(pointDuplicate?.value).toBe(999);
  });
});
