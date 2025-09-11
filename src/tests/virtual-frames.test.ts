import { describe, it, expect } from "vitest";
import type { RawValue } from "@semio/utils";
import { InstancedFrameInfo, Track, DragState, DraggedKeypoint } from "../types";
import {
  computeVirtualFrames,
  frameContainsDraggedKeypoints,
  getVirtualFrameStamp,
  getDraggedFrames,
  getNonDraggedFrames,
  getVirtualKeypointPositions,
} from "../functions/compute-virtual-frames";

// Mock data for testing
const mockTracks: Record<string, Track<RawValue>> = {
  track1: {
    id: "track1",
    name: "Track 1",
    animatableId: "animatable1",
    points: [
      { id: "point1", stamp: 100, value: 10 },
      { id: "point2", stamp: 300, value: 15 },
      { id: "point3", stamp: 500, value: 20 },
    ],
  },
  track2: {
    id: "track2",
    name: "Track 2",
    animatableId: "animatable2",
    points: [
      { id: "point4", stamp: 150, value: 1.2 },
      { id: "point5", stamp: 400, value: 2.1 },
    ],
  },
};

const mockFrames: InstancedFrameInfo[] = [
  {
    id: "point1",
    stamp: 100,
    points: [{ id: "point1", value: 10, trackId: "track1" }],
  },
  {
    id: "point4",
    stamp: 150,
    points: [{ id: "point4", value: 1.2, trackId: "track2" }],
  },
  {
    id: "point2",
    stamp: 300,
    points: [{ id: "point2", value: 15, trackId: "track1" }],
  },
  {
    id: "point5",
    stamp: 400,
    points: [{ id: "point5", value: 2.1, trackId: "track2" }],
  },
  {
    id: "point3",
    stamp: 500,
    points: [{ id: "point3", value: 20, trackId: "track1" }],
  },
];

function createMockDragState(
  draggedPoints: { keypointId: string; trackId: string; originalStamp: number; offset: number }[],
): DragState {
  const draggedKeypoints = new Map<string, DraggedKeypoint>();
  const startPositions = new Map<string, number>();

  draggedPoints.forEach(({ keypointId, trackId, originalStamp, offset }) => {
    draggedKeypoints.set(keypointId, {
      trackId,
      keypointId,
      originalStamp,
      currentOffset: offset,
    });
    startPositions.set(keypointId, originalStamp);
  });

  return {
    isDragging: true,
    draggedKeypoints,
    startPositions,
    deltaStamp: draggedPoints[0]?.offset || 0,
  };
}

describe("Virtual Frame Computation Functions", () => {
  describe("computeVirtualFrames", () => {
    it("should return normal frames when no drag state", () => {
      const result = computeVirtualFrames(mockTracks, null);

      expect(result).toHaveLength(5);
      expect(result[0].stamp).toBe(100);
      expect(result[1].stamp).toBe(150);
      expect(result[2].stamp).toBe(300);
    });

    it("should return normal frames when drag state is not dragging", () => {
      const dragState: DragState = {
        isDragging: false,
        draggedKeypoints: new Map(),
        startPositions: new Map(),
        deltaStamp: 0,
      };

      const result = computeVirtualFrames(mockTracks, dragState);

      expect(result).toHaveLength(5);
      expect(result[0].stamp).toBe(100);
    });

    it("should return virtual frames with drag offsets applied", () => {
      const dragState = createMockDragState([
        { keypointId: "point1", trackId: "track1", originalStamp: 100, offset: 50 },
        { keypointId: "point2", trackId: "track1", originalStamp: 300, offset: 50 },
      ]);

      const result = computeVirtualFrames(mockTracks, dragState);

      // Should have virtual positions for dragged points
      const point1Frame = result.find((f) => f.points.some((p) => p.id === "point1"));
      const point2Frame = result.find((f) => f.points.some((p) => p.id === "point2"));

      expect(point1Frame?.stamp).toBe(150); // 100 + 50
      expect(point2Frame?.stamp).toBe(350); // 300 + 50

      // Non-dragged points should remain unchanged
      const point4Frame = result.find((f) => f.points.some((p) => p.id === "point4"));
      expect(point4Frame?.stamp).toBe(150); // Original position
    });

    it("should handle negative drag offsets", () => {
      const dragState = createMockDragState([
        { keypointId: "point2", trackId: "track1", originalStamp: 300, offset: -100 },
      ]);

      const result = computeVirtualFrames(mockTracks, dragState);

      const point2Frame = result.find((f) => f.points.some((p) => p.id === "point2"));
      expect(point2Frame?.stamp).toBe(200); // 300 - 100
    });

    it("should maintain chronological order after applying offsets", () => {
      const dragState = createMockDragState([
        { keypointId: "point3", trackId: "track1", originalStamp: 500, offset: -400 }, // Moves to 100
      ]);

      const result = computeVirtualFrames(mockTracks, dragState);

      // Check that frames are still in chronological order
      for (let i = 1; i < result.length; i++) {
        expect(result[i].stamp).toBeGreaterThanOrEqual(result[i - 1].stamp);
      }
    });
  });

  describe("frameContainsDraggedKeypoints", () => {
    const dragState = createMockDragState([
      { keypointId: "point1", trackId: "track1", originalStamp: 100, offset: 50 },
      { keypointId: "point4", trackId: "track2", originalStamp: 150, offset: 50 },
    ]);

    it("should return true when frame contains dragged keypoints", () => {
      const frame = mockFrames[0]; // Contains point1
      expect(frameContainsDraggedKeypoints(frame, dragState)).toBe(true);
    });

    it("should return false when frame does not contain dragged keypoints", () => {
      const frame = mockFrames[2]; // Contains point2, not dragged
      expect(frameContainsDraggedKeypoints(frame, dragState)).toBe(false);
    });

    it("should return false when no drag state", () => {
      const frame = mockFrames[0];
      expect(frameContainsDraggedKeypoints(frame, null)).toBe(false);
    });

    it("should return false when drag state is not dragging", () => {
      const inactiveDragState: DragState = {
        isDragging: false,
        draggedKeypoints: new Map([["point1", {} as DraggedKeypoint]]),
        startPositions: new Map(),
        deltaStamp: 0,
      };

      const frame = mockFrames[0];
      expect(frameContainsDraggedKeypoints(frame, inactiveDragState)).toBe(false);
    });

    it("should handle frames with multiple points", () => {
      const mixedFrame: InstancedFrameInfo = {
        id: "mixed",
        stamp: 200,
        points: [
          { id: "point1", value: 10, trackId: "track1" }, // Dragged
          { id: "point2", value: 15, trackId: "track1" }, // Not dragged
        ],
      };

      expect(frameContainsDraggedKeypoints(mixedFrame, dragState)).toBe(true);
    });
  });

  describe("getVirtualFrameStamp", () => {
    const dragState = createMockDragState([
      { keypointId: "point1", trackId: "track1", originalStamp: 100, offset: 75 },
    ]);

    it("should return virtual stamp for dragged frames", () => {
      const frame = mockFrames[0]; // Contains point1
      expect(getVirtualFrameStamp(frame, dragState)).toBe(175); // 100 + 75
    });

    it("should return original stamp for non-dragged frames", () => {
      const frame = mockFrames[2]; // Contains point2, not dragged
      expect(getVirtualFrameStamp(frame, dragState)).toBe(300);
    });

    it("should return original stamp when no drag state", () => {
      const frame = mockFrames[0];
      expect(getVirtualFrameStamp(frame, null)).toBe(100);
    });

    it("should handle frames with multiple dragged points", () => {
      const multiDragState = createMockDragState([
        { keypointId: "point1", trackId: "track1", originalStamp: 100, offset: 50 },
        { keypointId: "point4", trackId: "track2", originalStamp: 150, offset: 75 },
      ]);

      const mixedFrame: InstancedFrameInfo = {
        id: "mixed",
        stamp: 200,
        points: [
          { id: "point1", value: 10, trackId: "track1" },
          { id: "point4", value: 1.2, trackId: "track2" },
        ],
      };

      // Should use the first dragged point's virtual position
      expect(getVirtualFrameStamp(mixedFrame, multiDragState)).toBe(150); // point1: 100 + 50
    });
  });

  describe("getDraggedFrames", () => {
    const dragState = createMockDragState([
      { keypointId: "point1", trackId: "track1", originalStamp: 100, offset: 50 },
      { keypointId: "point4", trackId: "track2", originalStamp: 150, offset: 50 },
    ]);

    it("should return only frames containing dragged keypoints", () => {
      const result = getDraggedFrames(mockFrames, dragState);

      expect(result).toHaveLength(2);
      expect(result[0].points[0].id).toBe("point1");
      expect(result[1].points[0].id).toBe("point4");
    });

    it("should return empty array when no drag state", () => {
      const result = getDraggedFrames(mockFrames, null);
      expect(result).toHaveLength(0);
    });

    it("should return empty array when drag state is not dragging", () => {
      const inactiveDragState: DragState = {
        isDragging: false,
        draggedKeypoints: new Map([["point1", {} as DraggedKeypoint]]),
        startPositions: new Map(),
        deltaStamp: 0,
      };

      const result = getDraggedFrames(mockFrames, inactiveDragState);
      expect(result).toHaveLength(0);
    });
  });

  describe("getNonDraggedFrames", () => {
    const dragState = createMockDragState([
      { keypointId: "point1", trackId: "track1", originalStamp: 100, offset: 50 },
    ]);

    it("should return frames not containing dragged keypoints", () => {
      const result = getNonDraggedFrames(mockFrames, dragState);

      expect(result).toHaveLength(4); // All except point1 frame
      expect(result.find((f) => f.points.some((p) => p.id === "point1"))).toBeUndefined();
      expect(result.find((f) => f.points.some((p) => p.id === "point2"))).toBeDefined();
    });

    it("should return all frames when no drag state", () => {
      const result = getNonDraggedFrames(mockFrames, null);
      expect(result).toHaveLength(mockFrames.length);
    });

    it("should return all frames when drag state is not dragging", () => {
      const inactiveDragState: DragState = {
        isDragging: false,
        draggedKeypoints: new Map([["point1", {} as DraggedKeypoint]]),
        startPositions: new Map(),
        deltaStamp: 0,
      };

      const result = getNonDraggedFrames(mockFrames, inactiveDragState);
      expect(result).toHaveLength(mockFrames.length);
    });
  });

  describe("getVirtualKeypointPositions", () => {
    it("should return virtual positions for all dragged keypoints", () => {
      const dragState = createMockDragState([
        { keypointId: "point1", trackId: "track1", originalStamp: 100, offset: 50 },
        { keypointId: "point2", trackId: "track1", originalStamp: 300, offset: -100 },
        { keypointId: "point4", trackId: "track2", originalStamp: 150, offset: 200 },
      ]);

      const result = getVirtualKeypointPositions(dragState);

      expect(result.size).toBe(3);
      expect(result.get("point1")).toBe(150); // 100 + 50
      expect(result.get("point2")).toBe(200); // 300 - 100
      expect(result.get("point4")).toBe(350); // 150 + 200
    });

    it("should return empty map when no drag state", () => {
      const result = getVirtualKeypointPositions(null);
      expect(result.size).toBe(0);
    });

    it("should return empty map when drag state is not dragging", () => {
      const inactiveDragState: DragState = {
        isDragging: false,
        draggedKeypoints: new Map([
          [
            "point1",
            {
              trackId: "track1",
              keypointId: "point1",
              originalStamp: 100,
              currentOffset: 50,
            },
          ],
        ]),
        startPositions: new Map(),
        deltaStamp: 0,
      };

      const result = getVirtualKeypointPositions(inactiveDragState);
      expect(result.size).toBe(0);
    });

    it("should handle zero offsets", () => {
      const dragState = createMockDragState([
        { keypointId: "point1", trackId: "track1", originalStamp: 100, offset: 0 },
      ]);

      const result = getVirtualKeypointPositions(dragState);

      expect(result.size).toBe(1);
      expect(result.get("point1")).toBe(100); // Original position
    });

    it("should handle negative offsets", () => {
      const dragState = createMockDragState([
        { keypointId: "point1", trackId: "track1", originalStamp: 500, offset: -300 },
      ]);

      const result = getVirtualKeypointPositions(dragState);

      expect(result.get("point1")).toBe(200); // 500 - 300
    });
  });

  describe("Integration scenarios", () => {
    it("should handle complex drag scenario with multiple tracks", () => {
      const complexDragState = createMockDragState([
        { keypointId: "point1", trackId: "track1", originalStamp: 100, offset: 200 },
        { keypointId: "point3", trackId: "track1", originalStamp: 500, offset: -200 },
        { keypointId: "point4", trackId: "track2", originalStamp: 150, offset: 100 },
      ]);

      const virtualFrames = computeVirtualFrames(mockTracks, complexDragState);
      const draggedFrames = getDraggedFrames(virtualFrames, complexDragState);
      const nonDraggedFrames = getNonDraggedFrames(virtualFrames, complexDragState);

      // Should have proper separation
      expect(draggedFrames.length + nonDraggedFrames.length).toBeLessThanOrEqual(
        virtualFrames.length,
      );

      // Check virtual positions
      const positions = getVirtualKeypointPositions(complexDragState);
      expect(positions.get("point1")).toBe(300); // 100 + 200
      expect(positions.get("point3")).toBe(300); // 500 - 200
      expect(positions.get("point4")).toBe(250); // 150 + 100
    });

    it("should handle edge case where dragged points overlap after offset", () => {
      const overlapDragState = createMockDragState([
        { keypointId: "point1", trackId: "track1", originalStamp: 100, offset: 50 },
        { keypointId: "point4", trackId: "track2", originalStamp: 150, offset: 0 },
      ]);

      // Both should end up at same timestamp (150)
      const positions = getVirtualKeypointPositions(overlapDragState);
      expect(positions.get("point1")).toBe(150);
      expect(positions.get("point4")).toBe(150);

      const virtualFrames = computeVirtualFrames(mockTracks, overlapDragState);

      // Should handle the overlap appropriately in frame computation
      expect(virtualFrames).toBeDefined();
      expect(virtualFrames.length).toBeGreaterThan(0);
    });
  });

  describe("Edge cases and error handling", () => {
    it("should handle empty tracks", () => {
      const result = computeVirtualFrames({}, null);
      expect(result).toEqual([]);
    });

    it("should handle drag state with non-existent keypoints", () => {
      const invalidDragState = createMockDragState([
        { keypointId: "nonexistent", trackId: "track1", originalStamp: 100, offset: 50 },
      ]);

      // Should not crash
      expect(() => computeVirtualFrames(mockTracks, invalidDragState)).not.toThrow();
    });

    it("should handle very large timestamp offsets", () => {
      const largeDragState = createMockDragState([
        { keypointId: "point1", trackId: "track1", originalStamp: 100, offset: 999999999 },
      ]);

      const positions = getVirtualKeypointPositions(largeDragState);
      expect(positions.get("point1")).toBe(1000000099);
    });

    it("should handle frames with empty points arrays", () => {
      const emptyFrame: InstancedFrameInfo = {
        id: "empty",
        stamp: 200,
        points: [],
      };

      const dragState = createMockDragState([
        { keypointId: "point1", trackId: "track1", originalStamp: 100, offset: 50 },
      ]);

      expect(frameContainsDraggedKeypoints(emptyFrame, dragState)).toBe(false);
      expect(getVirtualFrameStamp(emptyFrame, dragState)).toBe(200);
    });
  });
});
