import { describe, it, expect, beforeEach, vi } from "vitest";
import { enableMapSet } from "immer";
import type { RawValue } from "@semio/utils";
import { TimeDisplay } from "@semio/ui";
import { InstancedFrameInfo, Track } from "../types";
import { AnimationActions, AnimationData } from "../store-types";
import { startDragging, updateDragDelta, commitDrag, cancelDrag } from "../actions/drag";

// Enable Immer MapSet plugin for tests
enableMapSet();

// Mock data for testing
const mockTracks: Record<string, Track<RawValue>> = {
  track1: {
    id: "track1",
    name: "Track 1",
    animatableId: "animatable1",
    points: [
      { id: "point1", stamp: 100, value: 10 },
      { id: "point2", stamp: 300, value: 15 },
      { id: "point3", stamp: 900, value: 20 },
    ],
  },
  track2: {
    id: "track2",
    name: "Track 2",
    animatableId: "animatable2",
    points: [
      { id: "point4", stamp: 100, value: 1.2 },
      { id: "point5", stamp: 900, value: 2.1 },
    ],
  },
};

const mockFrames: InstancedFrameInfo[] = [
  {
    id: "point1-point4",
    stamp: 100,
    points: [
      { id: "point1", value: 10, trackId: "track1" },
      { id: "point4", value: 1.2, trackId: "track2" },
    ],
  },
  {
    id: "point2",
    stamp: 300,
    points: [{ id: "point2", value: 15, trackId: "track1" }],
  },
  {
    id: "point3-point5",
    stamp: 900,
    points: [
      { id: "point3", value: 20, trackId: "track1" },
      { id: "point5", value: 2.1, trackId: "track2" },
    ],
  },
];

function createMockState(): AnimationData {
  return {
    values: new Map(),
    velocities: new Map(),
    trackInterpolators: {},
    namespaceInfo: {},
    animations: {},
    tracks: mockTracks,
    visualizedAnimations: [],
    duration: 5000,
    framerate: 24,
    expanded: false,
    timeDisplay: TimeDisplay.Frames,
    playerInterval: undefined,
    previews: [],
    selection: [],
    referenceMarker: null,
    preferences: {
      hoverDashedLine: false,
      dataPreviews: true,
    },
    trackSubscribers: [],
    animationSubscribers: [],
    violations: {},
    animatables: {},
    dragState: null,
    updateKeypoints: vi.fn(),
  } as AnimationData & { updateKeypoints: any };
}

describe("Drag Actions", () => {
  let mockState: AnimationData & { updateKeypoints: any };
  let setCallHistory: any[];
  let updateKeypointsCalls: any[];

  const mockGet = () => mockState as AnimationData & AnimationActions;
  const mockSet = (updater: any) => {
    setCallHistory.push(updater);
    if (typeof updater === "function") {
      const result = updater(mockState as any);
      Object.assign(mockState, result);
    } else {
      Object.assign(mockState, updater);
    }
  };

  beforeEach(() => {
    mockState = createMockState() as any;
    setCallHistory = [];
    updateKeypointsCalls = [];

    // Mock updateKeypoints method
    mockState.updateKeypoints = vi.fn((updates, canMerge) => {
      updateKeypointsCalls.push({ updates, canMerge });
    }) as any;
  });

  describe("startDragging", () => {
    it("should initialize drag state with current selection", () => {
      mockState.selection = [mockFrames[0], mockFrames[1]];

      startDragging(mockGet, mockSet);

      expect(mockState.dragState).toBeTruthy();
      expect(mockState.dragState?.isDragging).toBe(true);
      expect(mockState.dragState?.deltaStamp).toBe(0);
      expect(mockState.dragState?.draggedKeypoints.size).toBe(3); // point1, point4, point2
      expect(mockState.dragState?.startPositions.size).toBe(3);

      // Verify specific keypoints
      const point1Info = mockState.dragState?.draggedKeypoints.get("point1");
      expect(point1Info).toEqual({
        trackId: "track1",
        keypointId: "point1",
        originalStamp: 100,
        currentOffset: 0,
      });
    });

    it("should initialize drag state with provided selection", () => {
      const providedSelection = [mockFrames[2]];

      startDragging(mockGet, mockSet, providedSelection);

      expect(mockState.dragState?.isDragging).toBe(true);
      expect(mockState.dragState?.draggedKeypoints.size).toBe(2); // point3, point5

      const point3Info = mockState.dragState?.draggedKeypoints.get("point3");
      expect(point3Info?.originalStamp).toBe(900);
    });

    it("should do nothing when no selection provided or current", () => {
      mockState.selection = [];

      startDragging(mockGet, mockSet);

      expect(mockState.dragState).toBeNull();
      expect(setCallHistory).toHaveLength(0);
    });

    it("should handle frames with multiple points", () => {
      mockState.selection = [mockFrames[0]]; // Frame with point1 and point4

      startDragging(mockGet, mockSet);

      expect(mockState.dragState?.draggedKeypoints.size).toBe(2);
      expect(mockState.dragState?.draggedKeypoints.has("point1")).toBe(true);
      expect(mockState.dragState?.draggedKeypoints.has("point4")).toBe(true);
    });
  });

  describe("updateDragDelta", () => {
    beforeEach(() => {
      mockState.selection = [mockFrames[0]];
      startDragging(mockGet, mockSet);
      setCallHistory = []; // Clear history after setup
    });

    it("should update drag delta without frame snapping", () => {
      const deltaStamp = 150;

      updateDragDelta(mockGet, mockSet, deltaStamp, false);

      expect(mockState.dragState?.deltaStamp).toBe(deltaStamp);
      mockState.dragState?.draggedKeypoints.forEach((dragInfo) => {
        expect(dragInfo.currentOffset).toBe(deltaStamp);
      });
    });

    it("should update drag delta with frame snapping", () => {
      const deltaStamp = 155; // Should snap to nearest frame
      const framerate = 24;
      const frameLength = 1000 / framerate; // ~41.67ms
      const expectedSnapped = Math.round(deltaStamp / frameLength) * frameLength;

      updateDragDelta(mockGet, mockSet, deltaStamp, true);

      expect(mockState.dragState?.deltaStamp).toBe(deltaStamp);
      mockState.dragState?.draggedKeypoints.forEach((dragInfo) => {
        expect(dragInfo.currentOffset).toBe(expectedSnapped);
      });
    });

    it("should do nothing when not dragging", () => {
      mockState.dragState = null;

      updateDragDelta(mockGet, mockSet, 100, false);

      expect(setCallHistory).toHaveLength(0);
    });

    it("should handle negative delta values", () => {
      const deltaStamp = -200;

      updateDragDelta(mockGet, mockSet, deltaStamp, false);

      expect(mockState.dragState?.deltaStamp).toBe(deltaStamp);
      mockState.dragState?.draggedKeypoints.forEach((dragInfo) => {
        expect(dragInfo.currentOffset).toBe(deltaStamp);
      });
    });

    it("should snap negative values to frame boundaries", () => {
      const deltaStamp = -155;
      const framerate = 24;
      const frameLength = 1000 / framerate;
      const expectedSnapped = Math.round(deltaStamp / frameLength) * frameLength;

      updateDragDelta(mockGet, mockSet, deltaStamp, true);

      mockState.dragState?.draggedKeypoints.forEach((dragInfo) => {
        expect(dragInfo.currentOffset).toBe(expectedSnapped);
      });
    });
  });

  describe("commitDrag", () => {
    beforeEach(() => {
      mockState.selection = [mockFrames[0], mockFrames[1]];
      startDragging(mockGet, mockSet);
      updateDragDelta(mockGet, mockSet, 200, false);
    });

    it("should apply all dragged keypoint updates", () => {
      commitDrag(mockGet, mockSet);

      expect(mockState.updateKeypoints).toHaveBeenCalledWith(
        expect.arrayContaining([
          {
            trackId: "track1",
            keypoint: { id: "point1", stamp: 300 }, // 100 + 200
          },
          {
            trackId: "track2",
            keypoint: { id: "point4", stamp: 300 }, // 100 + 200
          },
          {
            trackId: "track1",
            keypoint: { id: "point2", stamp: 500 }, // 300 + 200
          },
        ]),
        true, // canMerge should be true on commit
      );

      expect(mockState.dragState).toBeNull();
    });

    it("should do nothing when not dragging", () => {
      mockState.dragState = null;

      commitDrag(mockGet, mockSet);

      expect(mockState.updateKeypoints).not.toHaveBeenCalled();
    });

    it("should handle empty drag state", () => {
      mockState.dragState = {
        isDragging: true,
        draggedKeypoints: new Map(),
        startPositions: new Map(),
        deltaStamp: 100,
      };

      commitDrag(mockGet, mockSet);

      expect(mockState.updateKeypoints).not.toHaveBeenCalled();
      expect(mockState.dragState).toBeNull();
    });

    it("should preserve original stamps when no offset", () => {
      // Reset drag state with no delta
      mockState.selection = [mockFrames[0]];
      startDragging(mockGet, mockSet);
      // Don't call updateDragDelta, so currentOffset remains 0

      commitDrag(mockGet, mockSet);

      expect(mockState.updateKeypoints).toHaveBeenCalledWith(
        expect.arrayContaining([
          {
            trackId: "track1",
            keypoint: { id: "point1", stamp: 100 }, // Original stamp
          },
          {
            trackId: "track2",
            keypoint: { id: "point4", stamp: 100 }, // Original stamp
          },
        ]),
        true,
      );
    });
  });

  describe("cancelDrag", () => {
    beforeEach(() => {
      mockState.selection = [mockFrames[0]];
      startDragging(mockGet, mockSet);
      updateDragDelta(mockGet, mockSet, 300, false);
    });

    it("should clear drag state without applying changes", () => {
      cancelDrag(mockGet, mockSet);

      expect(mockState.updateKeypoints).not.toHaveBeenCalled();
      expect(mockState.dragState).toBeNull();
    });

    it("should do nothing when not dragging", () => {
      mockState.dragState = null;
      const initialSetCallsLength = setCallHistory.length;

      cancelDrag(mockGet, mockSet);

      expect(mockState.updateKeypoints).not.toHaveBeenCalled();
      expect(setCallHistory).toHaveLength(initialSetCallsLength);
    });
  });

  describe("Integration scenarios", () => {
    it("should handle complete drag workflow", () => {
      // Start drag
      mockState.selection = [mockFrames[1]];
      startDragging(mockGet, mockSet);

      expect(mockState.dragState?.isDragging).toBe(true);
      expect(mockState.dragState?.draggedKeypoints.size).toBe(1);

      // Update position multiple times
      updateDragDelta(mockGet, mockSet, 100, false);
      updateDragDelta(mockGet, mockSet, 200, false);
      updateDragDelta(mockGet, mockSet, 150, true); // With snapping

      expect(mockState.dragState?.deltaStamp).toBe(150);

      // Commit changes
      commitDrag(mockGet, mockSet);

      expect(mockState.updateKeypoints).toHaveBeenCalled();
      expect(mockState.dragState).toBeNull();
    });

    it("should handle drag and cancel workflow", () => {
      mockState.selection = [mockFrames[2]];
      startDragging(mockGet, mockSet);
      updateDragDelta(mockGet, mockSet, 500, false);

      // Cancel instead of commit
      cancelDrag(mockGet, mockSet);

      expect(mockState.updateKeypoints).not.toHaveBeenCalled();
      expect(mockState.dragState).toBeNull();
    });

    it("should handle concurrent drag attempts", () => {
      mockState.selection = [mockFrames[0]];
      startDragging(mockGet, mockSet);

      const firstDragState = mockState.dragState;

      // Attempt to start another drag while already dragging
      mockState.selection = [mockFrames[1]];
      startDragging(mockGet, mockSet);

      // Should replace the previous drag state
      expect(mockState.dragState).not.toBe(firstDragState);
      expect(mockState.dragState?.draggedKeypoints.size).toBe(1); // Only point2
    });
  });

  describe("Edge cases", () => {
    it("should handle very large timestamp values", () => {
      const largeFrame: InstancedFrameInfo = {
        id: "large",
        stamp: 999999999,
        points: [{ id: "largePoint", value: 1, trackId: "track1" }],
      };

      startDragging(mockGet, mockSet, [largeFrame]);
      updateDragDelta(mockGet, mockSet, 1000000, false);
      commitDrag(mockGet, mockSet);

      expect(mockState.updateKeypoints).toHaveBeenCalledWith(
        expect.arrayContaining([
          {
            trackId: "track1",
            keypoint: { id: "largePoint", stamp: 1000999999 },
          },
        ]),
        true,
      );
    });

    it("should handle negative timestamps after drag", () => {
      mockState.selection = [mockFrames[0]]; // stamp: 100
      startDragging(mockGet, mockSet);
      updateDragDelta(mockGet, mockSet, -200, false); // Would result in negative stamps

      commitDrag(mockGet, mockSet);

      expect(mockState.updateKeypoints).toHaveBeenCalledWith(
        expect.arrayContaining([
          {
            trackId: "track1",
            keypoint: { id: "point1", stamp: -100 },
          },
          {
            trackId: "track2",
            keypoint: { id: "point4", stamp: -100 },
          },
        ]),
        true,
      );
    });

    it("should handle zero delta drag", () => {
      mockState.selection = [mockFrames[1]];
      startDragging(mockGet, mockSet);
      updateDragDelta(mockGet, mockSet, 0, false);
      commitDrag(mockGet, mockSet);

      expect(mockState.updateKeypoints).toHaveBeenCalledWith(
        [
          {
            trackId: "track1",
            keypoint: { id: "point2", stamp: 300 }, // Original stamp
          },
        ],
        true,
      );
    });

    it("should handle frame snapping with custom framerates", () => {
      mockState.framerate = 30; // Different framerate
      mockState.selection = [mockFrames[0]];
      startDragging(mockGet, mockSet);

      const deltaStamp = 100;
      const frameLength = 1000 / 30; // 33.33ms
      const expectedSnapped = Math.round(deltaStamp / frameLength) * frameLength;

      updateDragDelta(mockGet, mockSet, deltaStamp, true);

      mockState.dragState?.draggedKeypoints.forEach((dragInfo) => {
        expect(dragInfo.currentOffset).toBeCloseTo(expectedSnapped, 2);
      });
    });
  });
});
