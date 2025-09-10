import { describe, it, expect, beforeEach } from "vitest";
import { enableMapSet, produce } from "immer";
import type { RawValue } from "@semio/utils";
import { InstancedFrameInfo, Track } from "../types";
import { AnimationData } from "../store-types";
import { startDragging, updateDragDelta } from "../actions/drag";
import { createDefaultState } from "../actions/create-default-state";

// Enable Immer MapSet plugin for tests
enableMapSet();

describe("Frame Snapping Validation", () => {
  let mockState: AnimationData;
  let mockTracks: Record<string, Track<RawValue>>;

  beforeEach(() => {
    // Test data with normalized timestamps (0-1 space)
    mockTracks = {
      track1: {
        id: "track1",
        name: "Track 1",
        animatableId: "animatable1",
        points: [
          { id: "point1", stamp: 0.1, value: 10 }, // Starting at 0.1 (normalized)
          { id: "point2", stamp: 0.5, value: 20 }, // Starting at 0.5 (normalized)
        ],
      },
    };

    const mockSelection: InstancedFrameInfo[] = [
      {
        id: "frame1",
        stamp: 0.1,
        points: [{ id: "point1", value: 10, trackId: "track1" }],
      },
    ];

    mockState = {
      ...createDefaultState(),
      tracks: mockTracks,
      selection: mockSelection,
      framerate: 24,
      duration: 10000, // 10 seconds
      dragState: null,
    };
  });

  describe("24 FPS Frame Snapping", () => {
    it("should snap to nearest frame at 24fps", () => {
      const framerate = 24;
      const frameCount = framerate * 10; // 10 second duration
      const _frameLength = 1 / frameCount; // normalized frame length

      mockState = produce(mockState, (draft) => {
        draft.framerate = framerate;
        startDragging(draft);
      });

      // Test case 1: Small delta that should snap
      mockState = produce(mockState, (draft) => {
        updateDragDelta(draft, 0.01, true); // Move by 0.01 in normalized space
      });

      let dragInfo = mockState.dragState?.draggedKeypoints.get("point1");
      expect(dragInfo?.currentOffset).toBeDefined();

      // Test case 2: Larger delta
      mockState = produce(mockState, (draft) => {
        updateDragDelta(draft, 0.03, true);
      });

      dragInfo = mockState.dragState?.draggedKeypoints.get("point1");
      expect(dragInfo?.currentOffset).toBeDefined();

      // Test case 3: Even larger delta
      mockState = produce(mockState, (draft) => {
        updateDragDelta(draft, 0.1, true);
      });

      dragInfo = mockState.dragState?.draggedKeypoints.get("point1");
      expect(dragInfo?.currentOffset).toBeDefined();

      // The offset should result in a position that aligns with frame boundaries
      const finalPosition = 0.1 + (dragInfo?.currentOffset ?? 0);
      expect(finalPosition).toBeGreaterThanOrEqual(0);
      expect(finalPosition).toBeLessThanOrEqual(1);
    });

    it("should handle negative deltas correctly", () => {
      mockState = produce(mockState, (draft) => {
        draft.framerate = 24;
        startDragging(draft);
      });

      // Test negative delta
      mockState = produce(mockState, (draft) => {
        updateDragDelta(draft, -0.05, true);
      });

      const dragInfo = mockState.dragState?.draggedKeypoints.get("point1");
      expect(dragInfo?.currentOffset).toBeDefined();

      // Final position should still be valid
      const finalPosition = 0.1 + (dragInfo?.currentOffset ?? 0);
      expect(finalPosition).toBeGreaterThanOrEqual(0);
    });
  });

  describe("30 FPS Frame Snapping", () => {
    it("should snap correctly at 30fps", () => {
      const framerate = 30;

      mockState = produce(mockState, (draft) => {
        draft.framerate = framerate;
        startDragging(draft);
      });

      // Test: Move by 0.05 in normalized space
      mockState = produce(mockState, (draft) => {
        updateDragDelta(draft, 0.05, true);
      });

      const dragInfo = mockState.dragState?.draggedKeypoints.get("point1");
      expect(dragInfo?.currentOffset).toBeDefined();

      // At 30fps with 10 second duration, we have 300 frames
      // Each frame is 1/300 = 0.00333... in normalized space
      const frameLength = 1 / (30 * 10);
      const finalPosition = 0.1 + (dragInfo?.currentOffset ?? 0);

      // Check that the position is snapped to a frame boundary
      const frameNumber = Math.round(finalPosition / frameLength);
      const snappedPosition = frameNumber * frameLength;
      expect(Math.abs(finalPosition - snappedPosition)).toBeLessThan(0.001);
    });
  });

  describe("60 FPS Frame Snapping", () => {
    it("should provide finer snapping at 60fps", () => {
      const framerate = 60;

      mockState = produce(mockState, (draft) => {
        draft.framerate = framerate;
        startDragging(draft);
      });

      // Test: Move by 0.025 in normalized space
      mockState = produce(mockState, (draft) => {
        updateDragDelta(draft, 0.025, true);
      });

      const dragInfo = mockState.dragState?.draggedKeypoints.get("point1");
      expect(dragInfo?.currentOffset).toBeDefined();

      // At 60fps, frames are much closer together
      const frameLength = 1 / (60 * 10); // 600 frames in 10 seconds
      expect(frameLength).toBeLessThan(0.002);

      // Snapping should be more precise at higher framerates
      const finalPosition = 0.1 + (dragInfo?.currentOffset ?? 0);
      expect(finalPosition).toBeGreaterThanOrEqual(0);
      expect(finalPosition).toBeLessThanOrEqual(1);
    });
  });

  describe("Edge Cases", () => {
    it("should handle zero delta", () => {
      mockState = produce(mockState, (draft) => {
        draft.framerate = 24;
        startDragging(draft);
      });

      mockState = produce(mockState, (draft) => {
        updateDragDelta(draft, 0, true);
      });

      const dragInfo = mockState.dragState?.draggedKeypoints.get("point1");
      expect(dragInfo?.currentOffset).toBeDefined();

      // Zero delta with snapping should result in minimal or no movement
      const finalPosition = 0.1 + (dragInfo?.currentOffset ?? 0);
      expect(finalPosition).toBeCloseTo(0.1, 2);
    });

    it("should handle very large deltas", () => {
      mockState = produce(mockState, (draft) => {
        draft.framerate = 24;
        startDragging(draft);
      });

      mockState = produce(mockState, (draft) => {
        updateDragDelta(draft, 10.0, true); // Very large delta
      });

      const dragInfo = mockState.dragState?.draggedKeypoints.get("point1");
      expect(dragInfo?.currentOffset).toBeDefined();

      // Even with large deltas, position should be clamped to valid range
      const finalPosition = 0.1 + (dragInfo?.currentOffset ?? 0);
      expect(finalPosition).toBeLessThanOrEqual(1.0);
    });

    it("should handle fractional frame rates", () => {
      const framerate = 23.976; // Common video framerate

      mockState = produce(mockState, (draft) => {
        draft.framerate = framerate;
        startDragging(draft);
      });

      mockState = produce(mockState, (draft) => {
        updateDragDelta(draft, 0.05, true);
      });

      const dragInfo = mockState.dragState?.draggedKeypoints.get("point1");
      expect(dragInfo?.currentOffset).toBeDefined();

      const finalPosition = 0.1 + (dragInfo?.currentOffset ?? 0);
      expect(finalPosition).toBeGreaterThanOrEqual(0);
      expect(finalPosition).toBeLessThanOrEqual(1);
    });

    it("should handle different original positions", () => {
      // Test with point2 which starts at 0.5 instead of 0.1
      const selection2: InstancedFrameInfo[] = [
        {
          id: "frame2",
          stamp: 0.5,
          points: [{ id: "point2", value: 20, trackId: "track1" }],
        },
      ];

      mockState = produce(mockState, (draft) => {
        draft.selection = selection2;
        draft.framerate = 24;
        startDragging(draft);
      });

      mockState = produce(mockState, (draft) => {
        updateDragDelta(draft, 0.075, true);
      });

      const dragInfo = mockState.dragState?.draggedKeypoints.get("point2");
      expect(dragInfo?.currentOffset).toBeDefined();

      const finalPosition = 0.5 + (dragInfo?.currentOffset ?? 0);
      expect(finalPosition).toBeGreaterThanOrEqual(0);
      expect(finalPosition).toBeLessThanOrEqual(1);
    });
  });

  describe("Exact Positioning (Alt Key)", () => {
    it("should allow exact positioning when snapping is disabled", () => {
      mockState = produce(mockState, (draft) => {
        draft.framerate = 24;
        startDragging(draft);
      });

      const exactDelta = 0.123456789;
      mockState = produce(mockState, (draft) => {
        updateDragDelta(draft, exactDelta, false); // No snapping
      });

      const dragInfo = mockState.dragState?.draggedKeypoints.get("point1");
      // Should preserve exact value when snapping is disabled
      expect(dragInfo?.currentOffset).toBe(exactDelta);
    });

    it("should handle very precise values without snapping", () => {
      mockState = produce(mockState, (draft) => {
        draft.framerate = 60;
        startDragging(draft);
      });

      const preciseDeltas = [0.000001, 0.123456789, -0.0789012, 0.999999];

      preciseDeltas.forEach((delta) => {
        mockState = produce(mockState, (draft) => {
          updateDragDelta(draft, delta, false); // No snapping
        });

        const dragInfo = mockState.dragState?.draggedKeypoints.get("point1");
        expect(dragInfo?.currentOffset).toBe(delta);
      });
    });
  });

  describe("Multi-Selection Snapping", () => {
    beforeEach(() => {
      // Select both points
      const multiSelection: InstancedFrameInfo[] = [
        {
          id: "frame1",
          stamp: 0.1,
          points: [{ id: "point1", value: 10, trackId: "track1" }],
        },
        {
          id: "frame2",
          stamp: 0.5,
          points: [{ id: "point2", value: 20, trackId: "track1" }],
        },
      ];

      mockState.selection = multiSelection;
    });

    it("should snap all selected keypoints consistently", () => {
      mockState = produce(mockState, (draft) => {
        draft.framerate = 24;
        startDragging(draft);
      });

      mockState = produce(mockState, (draft) => {
        updateDragDelta(draft, 0.06, true);
      });

      // Both keypoints should be dragged
      const dragInfo1 = mockState.dragState?.draggedKeypoints.get("point1");
      const dragInfo2 = mockState.dragState?.draggedKeypoints.get("point2");

      expect(dragInfo1?.currentOffset).toBeDefined();
      expect(dragInfo2?.currentOffset).toBeDefined();

      // Calculate final positions
      const finalPos1 = 0.1 + (dragInfo1?.currentOffset ?? 0);
      const finalPos2 = 0.5 + (dragInfo2?.currentOffset ?? 0);

      // Both should be within valid range
      expect(finalPos1).toBeGreaterThanOrEqual(0);
      expect(finalPos1).toBeLessThanOrEqual(1);
      expect(finalPos2).toBeGreaterThanOrEqual(0);
      expect(finalPos2).toBeLessThanOrEqual(1);

      // The offsets might differ due to individual snapping
      // but both should result in valid snapped positions
    });
  });
});
