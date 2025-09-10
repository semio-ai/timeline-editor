import { describe, it, expect, beforeEach, vi } from "vitest";
import { enableMapSet } from "immer";
import type { RawValue } from "@semio/utils";
import { TimeDisplay } from "@semio/ui";
import { InstancedFrameInfo, Track } from "../types";
import { AnimationActions, AnimationData } from "../store-types";
import { startDragging, updateDragDelta, commitDrag, cancelDrag } from "../actions/drag";
import { computeVirtualFrames } from "../functions/compute-virtual-frames";
import { createDefaultState } from "../actions/create-default-state";

// Enable Immer MapSet plugin for tests
enableMapSet();

// Mock data for integration testing
const mockTracks: Record<string, Track<RawValue>> = {
  positionX: {
    id: "positionX",
    name: "Position X",
    animatableId: "object1",
    points: [
      { id: "px1", stamp: 0, value: 0 },
      { id: "px2", stamp: 1000, value: 100 },
      { id: "px3", stamp: 2000, value: 50 },
    ],
  },
  positionY: {
    id: "positionY",
    name: "Position Y",
    animatableId: "object1",
    points: [
      { id: "py1", stamp: 0, value: 10 },
      { id: "py2", stamp: 1000, value: 20 },
      { id: "py3", stamp: 3000, value: 5 },
    ],
  },
  rotation: {
    id: "rotation",
    name: "Rotation",
    animatableId: "object2",
    points: [
      { id: "r1", stamp: 500, value: 0 },
      { id: "r2", stamp: 1500, value: 180 },
    ],
  },
};

const mockSelection: InstancedFrameInfo[] = [
  {
    id: "px1-py1",
    stamp: 0,
    points: [
      { id: "px1", value: 0, trackId: "positionX" },
      { id: "py1", value: 10, trackId: "positionY" },
    ],
  },
  {
    id: "px2-py2",
    stamp: 1000,
    points: [
      { id: "px2", value: 100, trackId: "positionX" },
      { id: "py2", value: 20, trackId: "positionY" },
    ],
  },
];

function createMockAnimationState(): AnimationData & { updateKeypoints: any } {
  const state = createDefaultState();
  return {
    ...state,
    tracks: mockTracks,
    selection: mockSelection,
    framerate: 24,
    timeDisplay: TimeDisplay.Frames,
    updateKeypoints: vi.fn(),
  } as AnimationData & { updateKeypoints: any };
}

describe("Drag Integration Tests", () => {
  let mockState: AnimationData & { updateKeypoints: any };
  let updateKeypointsCalls: any[];

  const mockGet = () => mockState as AnimationData & AnimationActions;
  const mockSet = (updater: any) => {
    if (typeof updater === "function") {
      const result = updater(mockState);
      Object.assign(mockState, result);
    } else {
      Object.assign(mockState, updater);
    }
  };

  beforeEach(() => {
    mockState = createMockAnimationState();
    updateKeypointsCalls = [];

    // Mock updateKeypoints method
    mockState.updateKeypoints = vi.fn((updates, canMerge) => {
      updateKeypointsCalls.push({ updates, canMerge });

      // Simulate actual keypoint updates for testing
      updates.forEach(({ trackId, keypoint }: any) => {
        const track = mockState.tracks[trackId];
        if (track && keypoint.id && keypoint.stamp !== undefined) {
          const point = track.points.find((p) => p.id === keypoint.id);
          if (point) {
            point.stamp = keypoint.stamp;
          }
        }
      });
    }) as any;
  });

  describe("Complete Drag Workflow", () => {
    it("should execute full drag-and-drop sequence", () => {
      // 1. Start dragging with current selection
      startDragging(mockGet, mockSet);

      // Verify drag state initialization
      expect(mockState.dragState?.isDragging).toBe(true);
      expect(mockState.dragState?.draggedKeypoints.size).toBe(4); // px1, py1, px2, py2
      expect(mockState.dragState?.deltaStamp).toBe(0);

      // 2. Update drag position multiple times (simulating mouse movement)
      updateDragDelta(mockGet, mockSet, 100, false);
      expect(mockState.dragState?.deltaStamp).toBe(100);

      updateDragDelta(mockGet, mockSet, 200, false);
      expect(mockState.dragState?.deltaStamp).toBe(200);

      updateDragDelta(mockGet, mockSet, 250, true); // With frame snapping
      const frameLength = 1000 / 24; // ~41.67ms
      const expectedSnapped = Math.round(250 / frameLength) * frameLength;
      expect(mockState.dragState?.deltaStamp).toBe(250);

      // Verify offsets are applied to individual keypoints
      mockState.dragState?.draggedKeypoints.forEach((dragInfo) => {
        expect(dragInfo.currentOffset).toBe(expectedSnapped);
      });

      // 3. Commit the drag operation
      commitDrag(mockGet, mockSet);

      // Verify changes were applied
      expect(mockState.updateKeypoints).toHaveBeenCalledWith(
        expect.arrayContaining([
          { trackId: "positionX", keypoint: { id: "px1", stamp: expectedSnapped } },
          { trackId: "positionY", keypoint: { id: "py1", stamp: expectedSnapped } },
          { trackId: "positionX", keypoint: { id: "px2", stamp: 1000 + expectedSnapped } },
          { trackId: "positionY", keypoint: { id: "py2", stamp: 1000 + expectedSnapped } },
        ]),
        true,
      );

      // Verify drag state is cleared
      expect(mockState.dragState).toBeNull();
    });

    it("should handle drag cancellation", () => {
      startDragging(mockGet, mockSet);
      updateDragDelta(mockGet, mockSet, 500, false);

      // Cancel instead of commit
      cancelDrag(mockGet, mockSet);

      // Verify no changes were applied
      expect(mockState.updateKeypoints).not.toHaveBeenCalled();
      expect(mockState.dragState).toBeNull();

      // Verify original track data is unchanged
      expect(mockState.tracks.positionX.points[0].stamp).toBe(0);
      expect(mockState.tracks.positionX.points[1].stamp).toBe(1000);
    });
  });

  describe("Virtual Frame Integration", () => {
    it("should produce virtual frames during drag operation", () => {
      // Start dragging
      startDragging(mockGet, mockSet);
      updateDragDelta(mockGet, mockSet, 300, false);

      // Generate virtual frames
      const virtualFrames = computeVirtualFrames(mockState.tracks, mockState.dragState);

      // Find virtual positions of dragged frames
      const virtualFrame1 = virtualFrames.find((f) =>
        f.points.some((p) => p.id === "px1" || p.id === "py1"),
      );
      const virtualFrame2 = virtualFrames.find((f) =>
        f.points.some((p) => p.id === "px2" || p.id === "py2"),
      );

      expect(virtualFrame1?.stamp).toBe(300); // 0 + 300
      expect(virtualFrame2?.stamp).toBe(1300); // 1000 + 300

      // Non-dragged frames should remain at original positions
      const rotationFrame = virtualFrames.find((f) => f.points.some((p) => p.id === "r1"));
      expect(rotationFrame?.stamp).toBe(500); // Original position
    });

    it("should handle virtual frames before and after drag", () => {
      // Before drag - should use normal frames
      const beforeFrames = computeVirtualFrames(mockState.tracks, mockState.dragState);
      expect(beforeFrames.find((f) => f.points.some((p) => p.id === "px1"))?.stamp).toBe(0);

      // During drag
      startDragging(mockGet, mockSet);
      updateDragDelta(mockGet, mockSet, 150, false);

      const duringFrames = computeVirtualFrames(mockState.tracks, mockState.dragState);
      expect(duringFrames.find((f) => f.points.some((p) => p.id === "px1"))?.stamp).toBe(150);

      // After commit - should reflect actual changes
      commitDrag(mockGet, mockSet);

      const afterFrames = computeVirtualFrames(mockState.tracks, mockState.dragState);
      expect(afterFrames.find((f) => f.points.some((p) => p.id === "px1"))?.stamp).toBe(150);
    });
  });

  describe("Multi-Selection Scenarios", () => {
    it("should handle dragging keypoints from different tracks", () => {
      // Select keypoints from different tracks at different times
      mockState.selection = [
        {
          id: "px2",
          stamp: 1000,
          points: [{ id: "px2", value: 100, trackId: "positionX" }],
        },
        {
          id: "r1",
          stamp: 500,
          points: [{ id: "r1", value: 0, trackId: "rotation" }],
        },
      ];

      startDragging(mockGet, mockSet);
      updateDragDelta(mockGet, mockSet, 200, false);
      commitDrag(mockGet, mockSet);

      expect(mockState.updateKeypoints).toHaveBeenCalledWith(
        expect.arrayContaining([
          { trackId: "positionX", keypoint: { id: "px2", stamp: 1200 } }, // 1000 + 200
          { trackId: "rotation", keypoint: { id: "r1", stamp: 700 } }, // 500 + 200
        ]),
        true,
      );
    });

    it("should maintain relative positioning between selected keypoints", () => {
      // Select keypoints with different original timestamps
      const frame1: InstancedFrameInfo = {
        id: "px1",
        stamp: 0,
        points: [{ id: "px1", value: 0, trackId: "positionX" }],
      };
      const frame2: InstancedFrameInfo = {
        id: "r2",
        stamp: 1500,
        points: [{ id: "r2", value: 180, trackId: "rotation" }],
      };

      mockState.selection = [frame1, frame2];

      startDragging(mockGet, mockSet);
      updateDragDelta(mockGet, mockSet, 100, false);

      // Check virtual positions maintain relative spacing
      const virtualFrames = computeVirtualFrames(mockState.tracks, mockState.dragState);
      const vFrame1 = virtualFrames.find((f) => f.points.some((p) => p.id === "px1"));
      const vFrame2 = virtualFrames.find((f) => f.points.some((p) => p.id === "r2"));

      expect(vFrame1?.stamp).toBe(100); // 0 + 100
      expect(vFrame2?.stamp).toBe(1600); // 1500 + 100
      expect((vFrame2?.stamp || 0) - (vFrame1?.stamp || 0)).toBe(1500); // Original relative distance
    });
  });

  describe("Frame Snapping Integration", () => {
    it("should snap to frame boundaries by default", () => {
      mockState.framerate = 30; // 30 FPS for easier calculation
      const frameLength = 1000 / 30; // 33.33ms

      startDragging(mockGet, mockSet);
      updateDragDelta(mockGet, mockSet, 50, true); // Snapping enabled (default behavior)

      // For absolute positioning: original (0) + delta (50) = 50ms
      // Frame length = 1000/30 = 33.333ms, so 50ms should snap to frame 1 (33.333ms)
      const expectedOffset = frameLength; // One frame length from origin

      // Verify all keypoints have snapped offsets
      mockState.dragState?.draggedKeypoints.forEach((dragInfo) => {
        expect(dragInfo.currentOffset).toBeCloseTo(expectedOffset, 1);
      });

      commitDrag(mockGet, mockSet);

      // Verify committed positions are also snapped
      const expectedSnappedPosition = frameLength; // Same as expectedOffset since original position is 0
      updateKeypointsCalls[0].updates.forEach((update: any) => {
        if (update.keypoint.id === "px1" || update.keypoint.id === "py1") {
          expect(update.keypoint.stamp).toBeCloseTo(expectedSnappedPosition, 1);
        }
      });
    });

    it("should allow exact positioning when alt is held (snapping disabled)", () => {
      startDragging(mockGet, mockSet);
      updateDragDelta(mockGet, mockSet, 123.456, false); // Exact positioning when alt held

      mockState.dragState?.draggedKeypoints.forEach((dragInfo) => {
        expect(dragInfo.currentOffset).toBe(123.456);
      });
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("should handle empty selection gracefully", () => {
      mockState.selection = [];

      startDragging(mockGet, mockSet);

      expect(mockState.dragState).toBeNull();
    });

    it("should handle dragging to negative timestamps", () => {
      startDragging(mockGet, mockSet);
      updateDragDelta(mockGet, mockSet, -100, false); // Would make px1,py1 negative

      commitDrag(mockGet, mockSet);

      const px1Update = updateKeypointsCalls[0].updates.find((u: any) => u.keypoint.id === "px1");
      expect(px1Update.keypoint.stamp).toBe(-100); // 0 + (-100)
    });

    it("should handle concurrent drag operations", () => {
      // Start first drag
      startDragging(mockGet, mockSet);
      const firstDragState = mockState.dragState;

      // Start second drag (should replace first)
      mockState.selection = [
        {
          id: "r1",
          stamp: 500,
          points: [{ id: "r1", value: 0, trackId: "rotation" }],
        },
      ];
      startDragging(mockGet, mockSet);

      expect(mockState.dragState).not.toBe(firstDragState);
      expect(mockState.dragState?.draggedKeypoints.size).toBe(1);
      expect(mockState.dragState?.draggedKeypoints.has("r1")).toBe(true);
    });

    it("should handle very large drag deltas", () => {
      startDragging(mockGet, mockSet);
      updateDragDelta(mockGet, mockSet, 999999999, false);

      commitDrag(mockGet, mockSet);

      const px1Update = updateKeypointsCalls[0].updates.find((u: any) => u.keypoint.id === "px1");
      expect(px1Update.keypoint.stamp).toBe(999999999); // 0 + large number
    });
  });

  describe("State Consistency", () => {
    it("should maintain consistent state throughout drag workflow", () => {
      const originalTrackData = JSON.parse(JSON.stringify(mockState.tracks));

      // Start drag - tracks should be unchanged
      startDragging(mockGet, mockSet);
      expect(mockState.tracks).toEqual(originalTrackData);

      // Update drag - tracks should still be unchanged
      updateDragDelta(mockGet, mockSet, 300, false);
      expect(mockState.tracks).toEqual(originalTrackData);

      // Only after commit should tracks be modified
      commitDrag(mockGet, mockSet);
      expect(mockState.tracks).not.toEqual(originalTrackData);
    });

    it("should not leave drag state inconsistent after cancel", () => {
      startDragging(mockGet, mockSet);
      updateDragDelta(mockGet, mockSet, 500, false);

      // Verify drag state exists
      expect(mockState.dragState?.isDragging).toBe(true);

      cancelDrag(mockGet, mockSet);

      // Should be completely clean
      expect(mockState.dragState).toBeNull();
    });

    it("should handle rapid drag updates without state corruption", () => {
      startDragging(mockGet, mockSet);

      // Rapid updates
      for (let i = 0; i < 100; i++) {
        updateDragDelta(mockGet, mockSet, i * 10, false);
        expect(mockState.dragState?.isDragging).toBe(true);
        expect(mockState.dragState?.deltaStamp).toBe(i * 10);
      }

      commitDrag(mockGet, mockSet);
      expect(mockState.dragState).toBeNull();
    });
  });

  describe("Performance Considerations", () => {
    it("should handle large selections efficiently", () => {
      // Create a large selection
      const largeSelection: InstancedFrameInfo[] = [];
      for (let i = 0; i < 1000; i++) {
        largeSelection.push({
          id: `point_${i.toString()}`,
          stamp: i * 10,
          points: [{ id: `point_${i.toString()}`, value: i, trackId: "positionX" }],
        });
      }

      mockState.selection = largeSelection;

      const startTime = performance.now();
      startDragging(mockGet, mockSet);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(100); // Should complete quickly
      expect(mockState.dragState?.draggedKeypoints.size).toBe(1000);
    });

    it("should handle frequent drag updates efficiently", () => {
      startDragging(mockGet, mockSet);

      const startTime = performance.now();
      for (let i = 0; i < 100; i++) {
        updateDragDelta(mockGet, mockSet, i, false);
      }
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(50); // Should handle rapid updates
    });
  });
});
