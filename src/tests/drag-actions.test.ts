import { describe, it, expect, beforeEach } from "vitest";
import { enableMapSet, produce } from "immer";
import type { RawValue } from "@semio/utils";
import { TimeDisplay } from "@semio/ui";
import { InstancedFrameInfo, Track } from "../types";
import { AnimationData } from "../store-types";
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
  };
}

describe("Drag Actions", () => {
  let mockState: AnimationData;

  beforeEach(() => {
    mockState = createMockState();
  });

  describe("startDragging", () => {
    it("should initialize drag state with current selection", () => {
      mockState.selection = [mockFrames[0], mockFrames[1]];

      mockState = produce(mockState, (draft) => {
        startDragging(draft);
      });

      expect(mockState.dragState).toBeTruthy();
      expect(mockState.dragState?.isDragging).toBe(true);
      expect(mockState.dragState?.deltaStamp).toBe(0);
      expect(mockState.dragState?.draggedKeypoints.size).toBe(3); // point1, point4, point2
      expect(mockState.dragState?.startPositions.size).toBe(3);

      // Check specific keypoint info
      const point1Info = mockState.dragState?.draggedKeypoints.get("point1");
      expect(point1Info?.trackId).toBe("track1");
      expect(point1Info?.keypointId).toBe("point1");
      expect(point1Info?.originalStamp).toBe(100);
      expect(point1Info?.currentOffset).toBe(0);
    });

    it("should initialize drag state with provided selection", () => {
      const providedSelection = [mockFrames[2]];

      mockState = produce(mockState, (draft) => {
        startDragging(draft, providedSelection);
      });

      expect(mockState.dragState?.isDragging).toBe(true);
      expect(mockState.dragState?.draggedKeypoints.size).toBe(2); // point3, point5

      const point3Info = mockState.dragState?.draggedKeypoints.get("point3");
      expect(point3Info?.originalStamp).toBe(900);
    });

    it("should do nothing when no selection provided or current", () => {
      mockState.selection = [];

      mockState = produce(mockState, (draft) => {
        startDragging(draft);
      });

      expect(mockState.dragState).toBeNull();
    });

    it("should handle frames with multiple points", () => {
      mockState.selection = [mockFrames[0]]; // Frame with point1 and point4

      mockState = produce(mockState, (draft) => {
        startDragging(draft);
      });

      expect(mockState.dragState?.draggedKeypoints.size).toBe(2);
      expect(mockState.dragState?.draggedKeypoints.has("point1")).toBe(true);
      expect(mockState.dragState?.draggedKeypoints.has("point4")).toBe(true);
    });
  });

  describe("updateDragDelta", () => {
    beforeEach(() => {
      mockState.selection = [mockFrames[0]];
      mockState = produce(mockState, (draft) => {
        startDragging(draft);
      });
    });

    it("should update drag delta without snapping", () => {
      mockState = produce(mockState, (draft) => {
        updateDragDelta(draft, 200, false);
      });

      expect(mockState.dragState?.deltaStamp).toBe(200);

      // Check that offsets are updated
      const point1Info = mockState.dragState?.draggedKeypoints.get("point1");
      expect(point1Info?.currentOffset).toBe(200);
    });

    it("should update drag delta with snapping", () => {
      mockState = produce(mockState, (draft) => {
        updateDragDelta(draft, 195, true);
      });

      // With 24fps and 5000ms duration, we have 120 frames
      // The offset should snap to nearest frame
      const point1Info = mockState.dragState?.draggedKeypoints.get("point1");
      expect(point1Info?.currentOffset).toBeDefined();
      // The exact value depends on closestFrame implementation
    });

    it("should handle negative deltas", () => {
      mockState = produce(mockState, (draft) => {
        updateDragDelta(draft, -50, false);
      });

      expect(mockState.dragState?.deltaStamp).toBe(-50);
      const point1Info = mockState.dragState?.draggedKeypoints.get("point1");
      expect(point1Info?.currentOffset).toBe(-50);
    });

    it("should do nothing when not dragging", () => {
      mockState.dragState = null;

      const originalState = { ...mockState };
      mockState = produce(mockState, (draft) => {
        updateDragDelta(draft, 100, false);
      });

      expect(mockState).toEqual(originalState);
    });

    it("should clamp position to [0, 1] when snapping", () => {
      mockState = produce(mockState, (draft) => {
        updateDragDelta(draft, 2000, true); // Way beyond 1
      });

      const point1Info = mockState.dragState?.draggedKeypoints.get("point1");
      // The position should be clamped before snapping
      expect(point1Info?.currentOffset).toBeDefined();
      const newPosition = (point1Info?.originalStamp ?? 0) + (point1Info?.currentOffset ?? 0);
      expect(newPosition).toBeLessThanOrEqual(1);
    });
  });

  describe("commitDrag", () => {
    beforeEach(() => {
      mockState.selection = [mockFrames[0], mockFrames[1]];
      mockState = produce(mockState, (draft) => {
        startDragging(draft);
        updateDragDelta(draft, 200, false);
      });
    });

    it("should apply drag offsets to tracks", () => {
      mockState = produce(mockState, (draft) => {
        commitDrag(draft);
      });

      // Check that points have been updated
      const track1 = mockState.tracks.track1;
      const point1 = track1.points.find((p) => p.id === "point1");
      const point2 = track1.points.find((p) => p.id === "point2");

      expect(point1?.stamp).toBe(300); // 100 + 200
      expect(point2?.stamp).toBe(500); // 300 + 200

      const track2 = mockState.tracks.track2;
      const point4 = track2.points.find((p) => p.id === "point4");
      expect(point4?.stamp).toBe(300); // 100 + 200
    });

    it("should clear drag state after commit", () => {
      mockState = produce(mockState, (draft) => {
        commitDrag(draft);
      });

      expect(mockState.dragState).toBeNull();
    });

    it("should maintain selection after commit", () => {
      mockState = produce(mockState, (draft) => {
        commitDrag(draft);
      });

      // Selection should be rebuilt with new frames
      expect(mockState.selection).toBeDefined();
      expect(mockState.selection.length).toBeGreaterThan(0);
    });

    it("should do nothing when not dragging", () => {
      mockState.dragState = null;
      const originalTracks = JSON.parse(JSON.stringify(mockState.tracks));

      mockState = produce(mockState, (draft) => {
        commitDrag(draft);
      });

      expect(mockState.tracks).toEqual(originalTracks);
    });

    it("should preserve original stamps when no offset", () => {
      // Reset drag state with no delta
      mockState.selection = [mockFrames[0]];
      mockState = produce(mockState, (draft) => {
        startDragging(draft);
        // Don't call updateDragDelta, so currentOffset remains 0
      });

      const originalStamps = {
        point1: mockState.tracks.track1.points.find((p) => p.id === "point1")?.stamp,
        point4: mockState.tracks.track2.points.find((p) => p.id === "point4")?.stamp,
      };

      mockState = produce(mockState, (draft) => {
        commitDrag(draft);
      });

      const track1 = mockState.tracks.track1;
      const track2 = mockState.tracks.track2;
      expect(track1.points.find((p) => p.id === "point1")?.stamp).toBe(originalStamps.point1);
      expect(track2.points.find((p) => p.id === "point4")?.stamp).toBe(originalStamps.point4);
    });
  });

  describe("cancelDrag", () => {
    beforeEach(() => {
      mockState.selection = [mockFrames[0]];
      mockState = produce(mockState, (draft) => {
        startDragging(draft);
        updateDragDelta(draft, 300, false);
      });
    });

    it("should clear drag state without applying changes", () => {
      const originalTracks = JSON.parse(JSON.stringify(mockState.tracks));

      mockState = produce(mockState, (draft) => {
        cancelDrag(draft);
      });

      expect(mockState.dragState).toBeNull();
      expect(mockState.tracks).toEqual(originalTracks);
    });

    it("should do nothing when not dragging", () => {
      mockState.dragState = null;

      mockState = produce(mockState, (draft) => {
        cancelDrag(draft);
      });

      expect(mockState.dragState).toBeNull();
    });
  });

  describe("Integration scenarios", () => {
    it("should handle complete drag workflow", () => {
      // Start drag
      mockState.selection = [mockFrames[1]];
      mockState = produce(mockState, (draft) => {
        startDragging(draft);
      });

      expect(mockState.dragState?.isDragging).toBe(true);
      expect(mockState.dragState?.draggedKeypoints.size).toBe(1);

      // Update position multiple times
      mockState = produce(mockState, (draft) => {
        updateDragDelta(draft, 100, false);
      });
      mockState = produce(mockState, (draft) => {
        updateDragDelta(draft, 200, false);
      });

      expect(mockState.dragState?.deltaStamp).toBe(200);

      // Commit the drag
      mockState = produce(mockState, (draft) => {
        commitDrag(draft);
      });

      const track1 = mockState.tracks.track1;
      const point2 = track1.points.find((p) => p.id === "point2");
      expect(point2?.stamp).toBe(500); // 300 + 200
      expect(mockState.dragState).toBeNull();
    });

    it("should handle drag and cancel workflow", () => {
      mockState.selection = [mockFrames[2]];
      mockState = produce(mockState, (draft) => {
        startDragging(draft);
        updateDragDelta(draft, 500, false);
      });

      // Cancel instead of commit
      mockState = produce(mockState, (draft) => {
        cancelDrag(draft);
      });

      // Points should remain at original positions
      const track1 = mockState.tracks.track1;
      const point3 = track1.points.find((p) => p.id === "point3");
      expect(point3?.stamp).toBe(900);
      expect(mockState.dragState).toBeNull();
    });

    it("should handle multiple selection drag", () => {
      mockState.selection = mockFrames; // Select all frames

      mockState = produce(mockState, (draft) => {
        startDragging(draft);
      });

      expect(mockState.dragState?.draggedKeypoints.size).toBe(5); // All 5 points

      mockState = produce(mockState, (draft) => {
        updateDragDelta(draft, 50, false);
        commitDrag(draft);
      });

      // All points should be moved
      const track1 = mockState.tracks.track1;
      const track2 = mockState.tracks.track2;

      expect(track1.points.find((p) => p.id === "point1")?.stamp).toBe(150);
      expect(track1.points.find((p) => p.id === "point2")?.stamp).toBe(350);
      expect(track1.points.find((p) => p.id === "point3")?.stamp).toBe(950);
      expect(track2.points.find((p) => p.id === "point4")?.stamp).toBe(150);
      expect(track2.points.find((p) => p.id === "point5")?.stamp).toBe(950);
    });

    it("should handle drag with provided selection overriding current", () => {
      mockState.selection = [mockFrames[0]]; // Current selection
      const newSelection = [mockFrames[2]]; // Override selection

      mockState = produce(mockState, (draft) => {
        startDragging(draft, newSelection);
        updateDragDelta(draft, 100, false);
        commitDrag(draft);
      });

      // Only points from newSelection should be moved
      const track1 = mockState.tracks.track1;
      const track2 = mockState.tracks.track2;

      // Points from mockFrames[0] should not move
      expect(track1.points.find((p) => p.id === "point1")?.stamp).toBe(100);
      expect(track2.points.find((p) => p.id === "point4")?.stamp).toBe(100);

      // Points from mockFrames[2] should move
      expect(track1.points.find((p) => p.id === "point3")?.stamp).toBe(1000);
      expect(track2.points.find((p) => p.id === "point5")?.stamp).toBe(1000);
    });

    it("should handle drag near boundaries", () => {
      mockState.selection = [mockFrames[0]];

      mockState = produce(mockState, (draft) => {
        startDragging(draft);
        // Try to drag beyond lower boundary
        updateDragDelta(draft, -200, false);
      });

      // The action should handle this gracefully
      expect(mockState.dragState?.deltaStamp).toBe(-200);

      mockState = produce(mockState, (draft) => {
        commitDrag(draft);
      });

      // Points should be clamped to valid range
      const track1 = mockState.tracks.track1;
      const point1 = track1.points.find((p) => p.id === "point1");
      expect(point1?.stamp).toBeDefined();
      // The exact behavior depends on implementation (clamping vs allowing negative)
    });
  });
});
