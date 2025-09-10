import { describe, it, expect, beforeEach, vi } from "vitest";
import { enableMapSet } from "immer";
import type { RawValue } from "@semio/utils";
import { InstancedFrameInfo, Track } from "../types";
import { AnimationData } from "../store-types";
import { startDragging, updateDragDelta } from "../actions/drag";
import { createDefaultState } from "../actions/create-default-state";

// Enable Immer MapSet plugin for tests
enableMapSet();

// Test data for frame snapping validation
const mockTracks: Record<string, Track<RawValue>> = {
  track1: {
    id: "track1",
    name: "Track 1",
    animatableId: "animatable1",
    points: [
      { id: "point1", stamp: 100, value: 10 }, // Starting at 100ms
      { id: "point2", stamp: 500, value: 20 }, // Starting at 500ms
    ],
  },
};

const mockSelection: InstancedFrameInfo[] = [
  {
    id: "frame1",
    stamp: 100,
    points: [{ id: "point1", value: 10, trackId: "track1" }],
  },
];

describe("Frame Snapping Validation", () => {
  let mockState: any;

  const mockGet = () => mockState as any;
  const mockSet = (updater: any) => {
    if (typeof updater === "function") {
      const result = updater({ ...mockState });
      mockState = { ...mockState, ...result };
    } else {
      mockState = { ...mockState, ...updater };
    }
  };

  beforeEach(() => {
    mockState = {
      ...createDefaultState(),
      tracks: mockTracks,
      selection: mockSelection,
      framerate: 24,
      dragState: null,
    };
  });

  describe("24 FPS Frame Snapping", () => {
    it("should snap to nearest frame at 24fps", () => {
      const framerate = 24;
      const frameLength = 1000 / framerate; // ~41.67ms per frame
      mockState.framerate = framerate;

      startDragging(mockGet, mockSet);

      // Test case 1: Small delta that should snap to same frame
      updateDragDelta(mockGet, mockSet, 10, true); // 100 + 10 = 110ms
      let dragInfo = mockState.dragState.draggedKeypoints.get("point1");
      let absolutePos = 100 + 10; // 110ms
      let expectedFrame = Math.round(absolutePos / frameLength);
      let expectedSnappedPos = expectedFrame * frameLength;
      let expectedOffset = expectedSnappedPos - 100;
      expect(dragInfo.currentOffset).toBeCloseTo(expectedOffset, 2);

      // Test case 2: Delta that should snap to next frame
      updateDragDelta(mockGet, mockSet, 30, true); // 100 + 30 = 130ms
      dragInfo = mockState.dragState.draggedKeypoints.get("point1");
      absolutePos = 100 + 30; // 130ms
      expectedFrame = Math.round(absolutePos / frameLength);
      expectedSnappedPos = expectedFrame * frameLength;
      expectedOffset = expectedSnappedPos - 100;
      expect(dragInfo.currentOffset).toBeCloseTo(expectedOffset, 2);

      // Test case 3: Larger delta
      updateDragDelta(mockGet, mockSet, 100, true); // 100 + 100 = 200ms
      dragInfo = mockState.dragState.draggedKeypoints.get("point1");
      absolutePos = 100 + 100; // 200ms
      expectedFrame = Math.round(absolutePos / frameLength);
      expectedSnappedPos = expectedFrame * frameLength;
      expectedOffset = expectedSnappedPos - 100;
      expect(dragInfo.currentOffset).toBeCloseTo(expectedOffset, 2);
    });

    it("should handle negative deltas correctly", () => {
      const framerate = 24;
      const frameLength = 1000 / framerate;
      mockState.framerate = framerate;

      startDragging(mockGet, mockSet);

      // Test negative delta: 100 - 50 = 50ms
      updateDragDelta(mockGet, mockSet, -50, true);
      const dragInfo = mockState.dragState.draggedKeypoints.get("point1");
      const absolutePos = 100 - 50; // 50ms
      const expectedFrame = Math.round(absolutePos / frameLength);
      const expectedSnappedPos = expectedFrame * frameLength;
      const expectedOffset = expectedSnappedPos - 100;
      expect(dragInfo.currentOffset).toBeCloseTo(expectedOffset, 2);
    });
  });

  describe("30 FPS Frame Snapping", () => {
    it("should snap correctly at 30fps", () => {
      const framerate = 30;
      const frameLength = 1000 / framerate; // ~33.33ms per frame
      mockState.framerate = framerate;

      startDragging(mockGet, mockSet);

      // Test: 100 + 50 = 150ms, should snap to nearest frame
      updateDragDelta(mockGet, mockSet, 50, true);
      const dragInfo = mockState.dragState.draggedKeypoints.get("point1");
      const absolutePos = 100 + 50; // 150ms
      const expectedFrame = Math.round(absolutePos / frameLength); // Round to nearest frame
      const expectedSnappedPos = expectedFrame * frameLength;
      const expectedOffset = expectedSnappedPos - 100;
      expect(dragInfo.currentOffset).toBeCloseTo(expectedOffset, 2);

      // Verify the calculation manually
      // At 30fps: frame 0 = 0ms, frame 1 = 33.33ms, frame 2 = 66.67ms, frame 3 = 100ms, frame 4 = 133.33ms, frame 5 = 166.67ms
      // 150ms should be closest to frame 4 (133.33ms) or frame 5 (166.67ms)
      // |150 - 133.33| = 16.67, |150 - 166.67| = 16.67, so could be either (Math.round will choose one)
      const frame4 = 4 * frameLength; // 133.33ms
      const frame5 = 5 * frameLength; // 166.67ms
      expect(expectedSnappedPos).toBeCloseTo(frame4, 1); // Should snap to frame 4 (Math.round chooses lower on ties)
    });
  });

  describe("60 FPS Frame Snapping", () => {
    it("should provide finer snapping at 60fps", () => {
      const framerate = 60;
      const frameLength = 1000 / framerate; // ~16.67ms per frame
      mockState.framerate = framerate;

      startDragging(mockGet, mockSet);

      // Test: 100 + 25 = 125ms
      updateDragDelta(mockGet, mockSet, 25, true);
      const dragInfo = mockState.dragState.draggedKeypoints.get("point1");
      const absolutePos = 100 + 25; // 125ms
      const expectedFrame = Math.round(absolutePos / frameLength);
      const expectedSnappedPos = expectedFrame * frameLength;
      const expectedOffset = expectedSnappedPos - 100;
      expect(dragInfo.currentOffset).toBeCloseTo(expectedOffset, 2);

      // At 60fps, frames are much closer together, so snapping should be more precise
      expect(Math.abs(dragInfo.currentOffset - 25)).toBeLessThan(frameLength / 2);
    });
  });

  describe("Edge Cases", () => {
    it("should handle zero delta", () => {
      mockState.framerate = 24;
      startDragging(mockGet, mockSet);

      updateDragDelta(mockGet, mockSet, 0, true);
      const dragInfo = mockState.dragState.draggedKeypoints.get("point1");

      // Zero delta means no movement, should snap to original position
      const frameLength = 1000 / 24;
      const expectedFrame = Math.round(100 / frameLength);
      const expectedSnappedPos = expectedFrame * frameLength;
      const expectedOffset = expectedSnappedPos - 100;
      expect(dragInfo.currentOffset).toBeCloseTo(expectedOffset, 2);
    });

    it("should handle very large deltas", () => {
      mockState.framerate = 24;
      startDragging(mockGet, mockSet);

      updateDragDelta(mockGet, mockSet, 10000, true); // 100 + 10000 = 10100ms
      const dragInfo = mockState.dragState.draggedKeypoints.get("point1");

      const frameLength = 1000 / 24;
      const absolutePos = 100 + 10000;
      const expectedFrame = Math.round(absolutePos / frameLength);
      const expectedSnappedPos = expectedFrame * frameLength;
      const expectedOffset = expectedSnappedPos - 100;
      expect(dragInfo.currentOffset).toBeCloseTo(expectedOffset, 2);
    });

    it("should handle fractional frame rates", () => {
      mockState.framerate = 23.976; // Common video framerate
      const frameLength = 1000 / 23.976;
      startDragging(mockGet, mockSet);

      updateDragDelta(mockGet, mockSet, 50, true);
      const dragInfo = mockState.dragState.draggedKeypoints.get("point1");

      const absolutePos = 100 + 50;
      const expectedFrame = Math.round(absolutePos / frameLength);
      const expectedSnappedPos = expectedFrame * frameLength;
      const expectedOffset = expectedSnappedPos - 100;
      expect(dragInfo.currentOffset).toBeCloseTo(expectedOffset, 2);
    });

    it("should handle different original positions", () => {
      // Test with point2 which starts at 500ms instead of 100ms
      mockState.selection = [
        {
          id: "frame2",
          stamp: 500,
          points: [{ id: "point2", value: 20, trackId: "track1" }],
        },
      ];

      mockState.framerate = 24;
      const frameLength = 1000 / 24;
      startDragging(mockGet, mockSet);

      updateDragDelta(mockGet, mockSet, 75, true); // 500 + 75 = 575ms
      const dragInfo = mockState.dragState.draggedKeypoints.get("point2");

      const absolutePos = 500 + 75; // 575ms
      const expectedFrame = Math.round(absolutePos / frameLength);
      const expectedSnappedPos = expectedFrame * frameLength;
      const expectedOffset = expectedSnappedPos - 500;
      expect(dragInfo.currentOffset).toBeCloseTo(expectedOffset, 2);
    });
  });

  describe("Exact Positioning (Alt Key)", () => {
    it("should allow exact positioning when snapping is disabled", () => {
      mockState.framerate = 24;
      startDragging(mockGet, mockSet);

      const exactDelta = 123.456789;
      updateDragDelta(mockGet, mockSet, exactDelta, false); // No snapping
      const dragInfo = mockState.dragState.draggedKeypoints.get("point1");

      // Should preserve exact value
      expect(dragInfo.currentOffset).toBe(exactDelta);
    });

    it("should handle very precise values without snapping", () => {
      mockState.framerate = 60;
      startDragging(mockGet, mockSet);

      const preciseDeltas = [0.001, 12.3456789, -7.8901234, 999.999999];

      preciseDeltas.forEach(delta => {
        updateDragDelta(mockGet, mockSet, delta, false); // No snapping
        const dragInfo = mockState.dragState.draggedKeypoints.get("point1");
        expect(dragInfo.currentOffset).toBe(delta);
      });
    });
  });

  describe("Multi-Selection Snapping", () => {
    beforeEach(() => {
      // Select both points
      mockState.selection = [
        {
          id: "frame1",
          stamp: 100,
          points: [{ id: "point1", value: 10, trackId: "track1" }],
        },
        {
          id: "frame2",
          stamp: 500,
          points: [{ id: "point2", value: 20, trackId: "track1" }],
        },
      ];
    });

    it("should snap all selected keypoints consistently", () => {
      mockState.framerate = 24;
      const frameLength = 1000 / 24;
      startDragging(mockGet, mockSet);

      updateDragDelta(mockGet, mockSet, 60, true);

      // Both keypoints should get the same treatment
      const dragInfo1 = mockState.dragState.draggedKeypoints.get("point1");
      const dragInfo2 = mockState.dragState.draggedKeypoints.get("point2");

      // Calculate expected values for each point
      const absolutePos1 = 100 + 60; // 160ms
      const expectedFrame1 = Math.round(absolutePos1 / frameLength);
      const expectedSnappedPos1 = expectedFrame1 * frameLength;
      const expectedOffset1 = expectedSnappedPos1 - 100;

      const absolutePos2 = 500 + 60; // 560ms
      const expectedFrame2 = Math.round(absolutePos2 / frameLength);
      const expectedSnappedPos2 = expectedFrame2 * frameLength;
      const expectedOffset2 = expectedSnappedPos2 - 500;

      expect(dragInfo1.currentOffset).toBeCloseTo(expectedOffset1, 2);
      expect(dragInfo2.currentOffset).toBeCloseTo(expectedOffset2, 2);
    });
  });
});
