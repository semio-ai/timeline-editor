import { describe, it, expect, beforeEach } from "vitest";
import { enableMapSet, produce } from "immer";
import type { RawValue } from "@semio/utils";
import type { Track } from "../types";
import type { AnimationData, AnimationActions } from "../store-types";
import { createDefaultState } from "../actions/create-default-state";
import { commitDrag } from "../actions/drag/commit-drag";
import { computeFrames } from "../functions/compute-frames";

// Enable Immer MapSet plugin for tests
enableMapSet();

describe("Drag Merge Selection - Focused Test", () => {
  let mockState: AnimationData;
  let mockGet: () => AnimationData & AnimationActions;
  let mockSet: (
    partial:
      | (AnimationData & AnimationActions)
      | Partial<AnimationData & AnimationActions>
      | ((
          state: AnimationData & AnimationActions,
        ) => (AnimationData & AnimationActions) | Partial<AnimationData & AnimationActions>),
    replace?: false | undefined,
  ) => void;

  beforeEach(() => {
    // Initialize mock state with simple test case
    mockState = {
      ...createDefaultState(),
      framerate: 24,
      duration: 10000,
      selection: [],
      referenceMarker: null,
      dragState: null,
      tracks: {
        track1: {
          id: "track1",
          name: "Track 1",
          animatableId: "anim1",
          points: [
            { id: "point1", stamp: 0.1, value: 10 }, // Will be selected and dragged
            { id: "point2", stamp: 0.2, value: 20 }, // NOT selected, at destination
          ],
        } as Track<RawValue>,
      },
    };

    mockGet = () => mockState as AnimationData & AnimationActions;
    mockSet = (partial, _replace) => {
      if (typeof partial === "function") {
        const result = partial(mockState as AnimationData & AnimationActions);
        if (result && typeof result === "object") {
          mockState = produce(mockState, (draft) => {
            Object.assign(draft, result);
          });
        }
      } else {
        mockState = produce(mockState, (draft) => {
          Object.assign(draft, partial);
        });
      }
    };
  });

  it("should select merged frame when dragging selected marker to same timestamp", () => {
    // Step 1: Setup initial selection - only point1 is selected
    const initialFrames = computeFrames(mockState.tracks);
    const frame1 = initialFrames.find((f) => f.points.some((p) => p.id === "point1"));
    expect(frame1).toBeDefined();
    expect(frame1?.points.length).toBe(1);
    expect(frame1?.stamp).toBe(0.1);

    // Select only frame1 (containing point1)
    mockState.selection = [frame1!];
    console.log("Initial selection:", mockState.selection);

    // Step 2: Setup drag state to simulate dragging point1 from 0.1 to 0.2
    mockState.dragState = {
      isDragging: true,
      draggedKeypoints: new Map([
        [
          "point1",
          {
            trackId: "track1",
            keypointId: "point1",
            originalStamp: 0.1,
            currentOffset: 0.1, // Moving from 0.1 to 0.2
          },
        ],
      ]),
      startPositions: new Map([["point1", 0.1]]),
      deltaStamp: 0.1,
    };

    // Step 3: Commit the drag
    commitDrag(mockGet, mockSet);

    // Step 4: Verify the results
    const finalFrames = computeFrames(mockState.tracks);
    console.log("Final frames:", finalFrames);

    // There should be a merged frame at 0.2 containing both points
    const mergedFrame = finalFrames.find((f) => Math.abs(f.stamp - 0.2) < 0.001);
    expect(mergedFrame).toBeDefined();
    expect(mergedFrame?.points.length).toBe(2);
    expect(mergedFrame?.points.some((p) => p.id === "point1")).toBe(true);
    expect(mergedFrame?.points.some((p) => p.id === "point2")).toBe(true);

    // Step 5: Verify selection - the merged frame should be selected
    console.log("Final selection:", mockState.selection);
    expect(mockState.selection.length).toBe(1);

    // The merged frame should be in the selection because it contains
    // point1 which was selected
    const isMergedFrameSelected = mockState.selection.some(
      (f) => f.points.some((p) => p.id === "point1") && f.points.some((p) => p.id === "point2"),
    );
    expect(isMergedFrameSelected).toBe(true);
  });

  it("should select merged frame when ALL points were previously selected", () => {
    // Setup: Select both point1 and point2
    const initialFrames = computeFrames(mockState.tracks);
    const frame1 = initialFrames.find((f) => f.points.some((p) => p.id === "point1"));
    const frame2 = initialFrames.find((f) => f.points.some((p) => p.id === "point2"));

    mockState.selection = [frame1!, frame2!];

    // Setup drag to move point1 to merge with point2 at 0.2
    mockState.dragState = {
      isDragging: true,
      draggedKeypoints: new Map([
        [
          "point1",
          {
            trackId: "track1",
            keypointId: "point1",
            originalStamp: 0.1,
            currentOffset: 0.1,
          },
        ],
      ]),
      startPositions: new Map([["point1", 0.1]]),
      deltaStamp: 0.1,
    };

    // Commit the drag
    commitDrag(mockGet, mockSet);

    // The merged frame SHOULD be selected because both points were selected
    expect(mockState.selection.length).toBe(1);
    expect(mockState.selection[0].points.length).toBe(2);
    expect(mockState.selection[0].stamp).toBeCloseTo(0.2, 3);
  });

  it("should handle multi-track merge correctly", () => {
    // Add a second track
    mockState.tracks.track2 = {
      id: "track2",
      name: "Track 2",
      animatableId: "anim2",
      points: [
        { id: "point3", stamp: 0.1, value: 30 }, // Will be selected
        { id: "point4", stamp: 0.2, value: 40 }, // NOT selected
      ],
    } as Track<RawValue>;

    // Select point1 (track1) and point3 (track2) at 0.1
    const initialFrames = computeFrames(mockState.tracks);
    const multiFrame = initialFrames.find(
      (f) => f.points.some((p) => p.id === "point1") && f.points.some((p) => p.id === "point3"),
    );
    expect(multiFrame).toBeDefined();
    mockState.selection = [multiFrame!];

    // Drag both to 0.2 where point2 and point4 exist
    mockState.dragState = {
      isDragging: true,
      draggedKeypoints: new Map([
        [
          "point1",
          {
            trackId: "track1",
            keypointId: "point1",
            originalStamp: 0.1,
            currentOffset: 0.1,
          },
        ],
        [
          "point3",
          {
            trackId: "track2",
            keypointId: "point3",
            originalStamp: 0.1,
            currentOffset: 0.1,
          },
        ],
      ]),
      startPositions: new Map([
        ["point1", 0.1],
        ["point3", 0.1],
      ]),
      deltaStamp: 0.1,
    };

    commitDrag(mockGet, mockSet);

    // The merged frame should be selected because it contains
    // the selected points (point1 and point3)
    expect(mockState.selection.length).toBe(1);

    // Verify the merge happened
    const finalFrames = computeFrames(mockState.tracks);
    const mergedFrame = finalFrames.find((f) => Math.abs(f.stamp - 0.2) < 0.001);
    expect(mergedFrame).toBeDefined();
    expect(mergedFrame?.points.length).toBe(4); // All 4 points at 0.2
  });
});
