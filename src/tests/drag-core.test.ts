import { describe, it, expect, beforeEach, vi } from "vitest";
import { enableMapSet, produce } from "immer";
import type { RawValue } from "@semio/utils";
import { Track, InstancedFrameInfo } from "../types";
import { AnimationData } from "../store-types";
import { startDragging, updateDragDelta, commitDrag, cancelDrag } from "../actions/drag";
import { computeFrames } from "../functions/compute-frames";
import { createDefaultState } from "../actions/create-default-state";

// Enable Immer MapSet plugin for tests
enableMapSet();

describe("Drag Core Functionality", () => {
  let mockState: AnimationData;
  let mockTracks: Record<string, Track<RawValue>>;

  beforeEach(() => {
    // Create mock tracks with normalized timestamps (0-1 space)
    mockTracks = {
      positionX: {
        id: "positionX",
        name: "Position X",
        animatableId: "object1",
        points: [
          { id: "px1", stamp: 0.0, value: 0 },
          { id: "px2", stamp: 0.25, value: 50 },
          { id: "px3", stamp: 0.5, value: 100 },
          { id: "px4", stamp: 0.75, value: 75 },
          { id: "px5", stamp: 1.0, value: 0 },
        ],
      },
      positionY: {
        id: "positionY",
        name: "Position Y",
        animatableId: "object1",
        points: [
          { id: "py1", stamp: 0.0, value: 0 },
          { id: "py2", stamp: 0.33, value: 100 },
          { id: "py3", stamp: 0.66, value: 50 },
          { id: "py4", stamp: 1.0, value: 0 },
        ],
      },
      rotation: {
        id: "rotation",
        name: "Rotation",
        animatableId: "object1",
        points: [
          { id: "r1", stamp: 0.0, value: 0 },
          { id: "r2", stamp: 0.5, value: 180 },
          { id: "r3", stamp: 1.0, value: 360 },
        ],
      },
    };

    // Initialize state with mock data
    mockState = createDefaultState();
    mockState.tracks = mockTracks;
    mockState.selection = [];
    mockState.dragState = null;
  });

  describe("startDragging", () => {
    it("should initialize drag state with selected keypoints", () => {
      // Select some frames
      const frames = computeFrames(mockTracks);
      const selectedFrames = frames.filter((f) =>
        f.points.some(p => p.id === "px2" || p.id === "px3")
      );
      mockState.selection = selectedFrames;

      const updatedState = produce(mockState, (draft) => {
        startDragging(draft);
      });

      expect(updatedState.dragState).toBeDefined();
      expect(updatedState.dragState?.isDragging).toBe(true);
      expect(updatedState.dragState?.draggedKeypoints.size).toBe(2);
      expect(updatedState.dragState?.draggedKeypoints.has("px2")).toBe(true);
      expect(updatedState.dragState?.draggedKeypoints.has("px3")).toBe(true);
    });

    it("should auto-select single keypoint when dragging unselected", () => {
      // Don't select anything initially
      mockState.selection = [];
      mockState.referenceMarker = {
        trackId: "positionX",
        keypointId: "px2",
      };

      const updatedState = produce(mockState, (draft) => {
        startDragging(draft);
      });

      expect(updatedState.dragState?.isDragging).toBe(true);
      expect(updatedState.dragState?.draggedKeypoints.size).toBe(1);
      expect(updatedState.dragState?.draggedKeypoints.has("px2")).toBe(true);
      expect(updatedState.selection).toHaveLength(1);
    });

    it("should handle empty selection gracefully", () => {
      mockState.selection = [];
      mockState.referenceMarker = null;

      const updatedState = produce(mockState, (draft) => {
        startDragging(draft);
      });

      expect(updatedState.dragState?.isDragging).toBe(true);
      expect(updatedState.dragState?.draggedKeypoints.size).toBe(0);
    });

    it("should store original positions for all dragged keypoints", () => {
      const frames = computeFrames(mockTracks);
      const selectedFrames = frames.filter((f) =>
        f.points.some(p => p.id === "px2" || p.id === "py2")
      );
      mockState.selection = selectedFrames;

      const updatedState = produce(mockState, (draft) => {
        startDragging(draft);
      });

      const px2DragInfo = updatedState.dragState?.draggedKeypoints.get("px2");
      const py2DragInfo = updatedState.dragState?.draggedKeypoints.get("py2");

      expect(px2DragInfo?.originalStamp).toBe(0.25);
      expect(py2DragInfo?.originalStamp).toBe(0.33);
      expect(px2DragInfo?.currentOffset).toBe(0);
      expect(py2DragInfo?.currentOffset).toBe(0);
    });

    it("should handle multi-track selection", () => {
      const frames = computeFrames(mockTracks);
      // Select frame at 0.0 which has points from all tracks
      const frame0 = frames.find(f => f.stamp === 0.0);
      mockState.selection = frame0 ? [frame0] : [];

      const updatedState = produce(mockState, (draft) => {
        startDragging(draft);
      });

      expect(updatedState.dragState?.draggedKeypoints.size).toBe(3);
      expect(updatedState.dragState?.draggedKeypoints.has("px1")).toBe(true);
      expect(updatedState.dragState?.draggedKeypoints.has("py1")).toBe(true);
      expect(updatedState.dragState?.draggedKeypoints.has("r1")).toBe(true);
    });
  });

  describe("updateDragDelta", () => {
    beforeEach(() => {
      // Setup initial drag state
      const frames = computeFrames(mockTracks);
      const selectedFrames = frames.filter((f) =>
        f.points.some(p => p.id === "px2" || p.id === "px3")
      );
      mockState.selection = selectedFrames;
      mockState = produce(mockState, (draft) => {
        startDragging(draft);
      });
    });

    it("should update drag offsets for all dragged keypoints", () => {
      const updatedState = produce(mockState, (draft) => {
        updateDragDelta(draft, 0.1, false);
      });

      const px2DragInfo = updatedState.dragState?.draggedKeypoints.get("px2");
      const px3DragInfo = updatedState.dragState?.draggedKeypoints.get("px3");

      expect(px2DragInfo?.currentOffset).toBe(0.1);
      expect(px3DragInfo?.currentOffset).toBe(0.1);
      expect(updatedState.dragState?.deltaStamp).toBe(0.1);
    });

    it("should snap to frame boundaries when snapping is enabled", () => {
      mockState.frameStamps = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];

      const updatedState = produce(mockState, (draft) => {
        // Move px2 from 0.25 by 0.07 = 0.32, should snap to 0.3
        updateDragDelta(draft, 0.07, true);
      });

      const px2DragInfo = updatedState.dragState?.draggedKeypoints.get("px2");
      // 0.25 + offset should snap to 0.3, so offset should be 0.05
      expect(px2DragInfo?.currentOffset).toBeCloseTo(0.05, 5);
    });

    it("should allow exact positioning when snapping is disabled", () => {
      mockState.frameStamps = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];

      const updatedState = produce(mockState, (draft) => {
        updateDragDelta(draft, 0.123, false);
      });

      const px2DragInfo = updatedState.dragState?.draggedKeypoints.get("px2");
      expect(px2DragInfo?.currentOffset).toBe(0.123);
    });

    it("should handle negative offsets", () => {
      const updatedState = produce(mockState, (draft) => {
        updateDragDelta(draft, -0.15, false);
      });

      const px2DragInfo = updatedState.dragState?.draggedKeypoints.get("px2");
      const px3DragInfo = updatedState.dragState?.draggedKeypoints.get("px3");

      expect(px2DragInfo?.currentOffset).toBe(-0.15);
      expect(px3DragInfo?.currentOffset).toBe(-0.15);
    });

    it("should clamp positions to valid range", () => {
      const updatedState = produce(mockState, (draft) => {
        // Try to move px5 (at 1.0) beyond 1.0
        draft.selection = computeFrames(draft.tracks).filter(f =>
          f.points.some(p => p.id === "px5")
        );
        startDragging(draft);
        updateDragDelta(draft, 0.2, false);
      });

      const px5DragInfo = updatedState.dragState?.draggedKeypoints.get("px5");
      // Position should be clamped to 1.0
      const finalPosition = 1.0 + (px5DragInfo?.currentOffset ?? 0);
      expect(finalPosition).toBeLessThanOrEqual(1.0);
    });
  });

  describe("commitDrag", () => {
    beforeEach(() => {
      const frames = computeFrames(mockTracks);
      const selectedFrames = frames.filter((f) =>
        f.points.some(p => p.id === "px2")
      );
      mockState.selection = selectedFrames;
      mockState = produce(mockState, (draft) => {
        startDragging(draft);
        updateDragDelta(draft, 0.2, false);
      });
    });

    it("should apply drag offsets to track points", () => {
      const updatedState = produce(mockState, (draft) => {
        commitDrag(draft);
      });

      const px2Point = updatedState.tracks.positionX.points.find(p => p.id === "px2");
      expect(px2Point?.stamp).toBeCloseTo(0.45, 5); // 0.25 + 0.2
    });

    it("should clear drag state after commit", () => {
      const updatedState = produce(mockState, (draft) => {
        commitDrag(draft);
      });

      expect(updatedState.dragState).toBeNull();
    });

    it("should maintain selection after commit", () => {
      const initialSelectionCount = mockState.selection.length;

      const updatedState = produce(mockState, (draft) => {
        commitDrag(draft);
      });

      expect(updatedState.selection).toHaveLength(initialSelectionCount);
      const selectedFrame = updatedState.selection[0];
      expect(selectedFrame.stamp).toBeCloseTo(0.45, 5);
    });

    it("should handle merging when keypoints move to same timestamp", () => {
      // Select px2 (at 0.25) and px3 (at 0.5)
      const frames = computeFrames(mockTracks);
      const selectedFrames = frames.filter((f) =>
        f.points.some(p => p.id === "px2" || p.id === "px3")
      );
      mockState.selection = selectedFrames;

      mockState = produce(mockState, (draft) => {
        startDragging(draft);
        // Move px2 from 0.25 to 0.5 (same as px3)
        updateDragDelta(draft, 0.25, false);
      });

      const updatedState = produce(mockState, (draft) => {
        commitDrag(draft);
      });

      const px2Point = updatedState.tracks.positionX.points.find(p => p.id === "px2");
      const px3Point = updatedState.tracks.positionX.points.find(p => p.id === "px3");

      expect(px2Point?.stamp).toBeCloseTo(0.5, 5);
      expect(px3Point?.stamp).toBeCloseTo(0.75, 5); // px3 also moved by 0.25

      // Check that frames are properly computed after merge
      const finalFrames = computeFrames(updatedState.tracks);
      const frame05 = finalFrames.find(f => Math.abs(f.stamp - 0.5) < 0.001);
      expect(frame05).toBeDefined();
    });

    it("should sort points chronologically after commit", () => {
      // Move px3 before px2
      const frames = computeFrames(mockTracks);
      const selectedFrames = frames.filter((f) =>
        f.points.some(p => p.id === "px3")
      );
      mockState.selection = selectedFrames;

      mockState = produce(mockState, (draft) => {
        startDragging(draft);
        updateDragDelta(draft, -0.4, false); // Move from 0.5 to 0.1
      });

      const updatedState = produce(mockState, (draft) => {
        commitDrag(draft);
      });

      const posXPoints = updatedState.tracks.positionX.points;
      const px3Index = posXPoints.findIndex(p => p.id === "px3");
      const px2Index = posXPoints.findIndex(p => p.id === "px2");

      expect(px3Index).toBeLessThan(px2Index);

      // Verify points are sorted by stamp
      for (let i = 1; i < posXPoints.length; i++) {
        expect(posXPoints[i].stamp).toBeGreaterThanOrEqual(posXPoints[i - 1].stamp);
      }
    });
  });

  describe("cancelDrag", () => {
    beforeEach(() => {
      const frames = computeFrames(mockTracks);
      const selectedFrames = frames.filter((f) =>
        f.points.some(p => p.id === "px2" || p.id === "px3")
      );
      mockState.selection = selectedFrames;
      mockState = produce(mockState, (draft) => {
        startDragging(draft);
        updateDragDelta(draft, 0.2, false);
      });
    });

    it("should clear drag state without applying changes", () => {
      const originalPx2Stamp = mockTracks.positionX.points.find(p => p.id === "px2")?.stamp;

      const updatedState = produce(mockState, (draft) => {
        cancelDrag(draft);
      });

      expect(updatedState.dragState).toBeNull();
      const px2Point = updatedState.tracks.positionX.points.find(p => p.id === "px2");
      expect(px2Point?.stamp).toBe(originalPx2Stamp);
    });

    it("should maintain selection after cancel", () => {
      const initialSelection = [...mockState.selection];

      const updatedState = produce(mockState, (draft) => {
        cancelDrag(draft);
      });

      expect(updatedState.selection).toEqual(initialSelection);
    });

    it("should restore original positions", () => {
      const originalPositions = mockTracks.positionX.points.map(p => ({
        id: p.id,
        stamp: p.stamp,
      }));

      const updatedState = produce(mockState, (draft) => {
        cancelDrag(draft);
      });

      updatedState.tracks.positionX.points.forEach((point, i) => {
        expect(point.stamp).toBe(originalPositions[i].stamp);
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle dragging with no tracks", () => {
      mockState.tracks = {};
      mockState.selection = [];

      const updatedState = produce(mockState, (draft) => {
        startDragging(draft);
        updateDragDelta(draft, 0.1, false);
        commitDrag(draft);
      });

      expect(updatedState.dragState).toBeNull();
      expect(updatedState.tracks).toEqual({});
    });

    it("should handle very large drag deltas", () => {
      const frames = computeFrames(mockTracks);
      const selectedFrames = frames.filter((f) =>
        f.points.some(p => p.id === "px2")
      );
      mockState.selection = selectedFrames;

      const updatedState = produce(mockState, (draft) => {
        startDragging(draft);
        updateDragDelta(draft, 10.0, false); // Very large delta
        commitDrag(draft);
      });

      const px2Point = updatedState.tracks.positionX.points.find(p => p.id === "px2");
      expect(px2Point?.stamp).toBeLessThanOrEqual(1.0);
      expect(px2Point?.stamp).toBeGreaterThanOrEqual(0.0);
    });

    it("should handle concurrent drag operations gracefully", () => {
      const frames = computeFrames(mockTracks);
      const selectedFrames = frames.filter((f) =>
        f.points.some(p => p.id === "px2")
      );
      mockState.selection = selectedFrames;

      const updatedState = produce(mockState, (draft) => {
        startDragging(draft);
        updateDragDelta(draft, 0.1, false);

        // Try to start another drag without committing
        startDragging(draft);
        updateDragDelta(draft, 0.2, false);

        commitDrag(draft);
      });

      // Should handle the second drag operation
      const px2Point = updatedState.tracks.positionX.points.find(p => p.id === "px2");
      expect(px2Point?.stamp).toBeCloseTo(0.45, 5); // 0.25 + 0.2
    });

    it("should handle dragging to exact boundary positions", () => {
      const frames = computeFrames(mockTracks);
      const selectedFrames = frames.filter((f) =>
        f.points.some(p => p.id === "px2")
      );
      mockState.selection = selectedFrames;

      // Test dragging to 0.0
      let updatedState = produce(mockState, (draft) => {
        startDragging(draft);
        updateDragDelta(draft, -0.25, false); // Move to 0.0
        commitDrag(draft);
      });

      let px2Point = updatedState.tracks.positionX.points.find(p => p.id === "px2");
      expect(px2Point?.stamp).toBe(0.0);

      // Test dragging to 1.0
      const frames2 = computeFrames(updatedState.tracks);
      const selectedFrames2 = frames2.filter((f) =>
        f.points.some(p => p.id === "px3")
      );
      updatedState.selection = selectedFrames2;

      updatedState = produce(updatedState, (draft) => {
        startDragging(draft);
        updateDragDelta(draft, 0.5, false); // Move from 0.5 to 1.0
        commitDrag(draft);
      });

      const px3Point = updatedState.tracks.positionX.points.find(p => p.id === "px3");
      expect(px3Point?.stamp).toBe(1.0);
    });
  });
});
