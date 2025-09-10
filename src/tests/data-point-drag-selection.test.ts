import { describe, it, expect, beforeEach } from "vitest";
import { enableMapSet, produce } from "immer";
import type { RawValue } from "@semio/utils";
import type { InstancedFrameInfo, Track } from "../types";
import type { AnimationData } from "../store-types";
import { createDefaultState } from "../actions/create-default-state";
import { startDragging, updateDragDelta, commitDrag, cancelDrag } from "../actions/drag";
import { computeVirtualFrames } from "../functions/compute-virtual-frames";
import {
  compareInstancedFrames,
  compareInstancedFramesIgnoringStamp,
  FrameComparison,
} from "../functions/compare-instanced-frames";

// Enable Immer MapSet plugin for tests
enableMapSet();

describe("3D DataPoint Drag Selection Persistence", () => {
  let mockState: AnimationData;

  beforeEach(() => {
    // Initialize mock state
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
          type: "number",
          points: [
            { id: "point1", stamp: 0.1, value: 10 },
            { id: "point2", stamp: 0.2, value: 20 },
            { id: "point3", stamp: 0.3, value: 30 },
          ],
        } as Track<RawValue>,
        track2: {
          id: "track2",
          name: "Track 2",
          animatableId: "anim2",
          type: "number",
          points: [
            { id: "point4", stamp: 0.1, value: 15 },
            { id: "point5", stamp: 0.25, value: 25 },
          ],
        } as Track<RawValue>,
      },
    };
  });

  describe("Selection Visual During Drag with Stamp-Ignoring Comparison", () => {
    it("should maintain selection visual using stamp-ignoring comparison during drag", () => {
      // Set initial selection
      const selectedFrame: InstancedFrameInfo = {
        id: "point1",
        stamp: 0.1,
        points: [{ id: "point1", trackId: "track1", value: 10 }],
      };
      mockState.selection = [selectedFrame];

      // Start dragging and apply delta
      mockState = produce(mockState, (draft) => {
        startDragging(draft);
        updateDragDelta(draft, 0.05, false);
      });

      // Get virtual frames (which have different stamps)
      const virtualFrames = computeVirtualFrames(mockState.tracks, mockState.dragState);
      const virtualFrame = virtualFrames.find((f) => f.points.some((p) => p.id === "point1"));

      expect(virtualFrame).toBeDefined();
      expect(virtualFrame?.stamp).toBe(0.15); // 0.1 + 0.05

      // Regular comparison should fail due to stamp difference
      const regularComparison = compareInstancedFrames(selectedFrame, virtualFrame!);
      expect(regularComparison).toBe(FrameComparison.Incompatible);

      // Stamp-ignoring comparison should succeed
      const ignoringStampComparison = compareInstancedFramesIgnoringStamp(
        selectedFrame,
        virtualFrame!,
      );
      expect(ignoringStampComparison).toBe(FrameComparison.Equal);

      // Simulate DataPoint selection check during drag
      const isSelectedDuringDrag = mockState.dragState?.isDragging
        ? compareInstancedFramesIgnoringStamp(selectedFrame, virtualFrame!) ===
            FrameComparison.Equal ||
          compareInstancedFramesIgnoringStamp(selectedFrame, virtualFrame!) ===
            FrameComparison.Superset
        : compareInstancedFrames(selectedFrame, virtualFrame!) === FrameComparison.Equal ||
          compareInstancedFrames(selectedFrame, virtualFrame!) === FrameComparison.Superset;

      expect(isSelectedDuringDrag).toBe(true);
    });

    it("should handle multi-point frames with stamp-ignoring comparison", () => {
      // Set multi-track selection at same timestamp
      const multiPointFrame: InstancedFrameInfo = {
        id: "point1",
        stamp: 0.1,
        points: [
          { id: "point1", trackId: "track1", value: 10 },
          { id: "point4", trackId: "track2", value: 15 },
        ],
      };
      mockState.selection = [multiPointFrame];

      // Start dragging
      mockState = produce(mockState, (draft) => {
        startDragging(draft);
        updateDragDelta(draft, 0.1, false);
      });

      // Get virtual frames
      const virtualFrames = computeVirtualFrames(mockState.tracks, mockState.dragState);
      const virtualMultiFrame = virtualFrames.find(
        (f) => f.points.some((p) => p.id === "point1") && f.points.some((p) => p.id === "point4"),
      );

      expect(virtualMultiFrame).toBeDefined();
      expect(virtualMultiFrame?.stamp).toBe(0.2); // 0.1 + 0.1

      // Stamp-ignoring comparison should work for multi-point frames
      const comparison = compareInstancedFramesIgnoringStamp(multiPointFrame, virtualMultiFrame!);
      expect(comparison).toBe(FrameComparison.Equal);
    });

    it("should handle reference marker with stamp-ignoring comparison", () => {
      const referenceFrame: InstancedFrameInfo = {
        id: "point2",
        stamp: 0.2,
        points: [{ id: "point2", trackId: "track1", value: 20 }],
      };

      mockState.referenceMarker = {
        marker: referenceFrame,
        sources: [{ trackId: "track1", type: "number" }],
      };

      // Start dragging the reference marker
      mockState.selection = [referenceFrame];
      mockState = produce(mockState, (draft) => {
        startDragging(draft);
        updateDragDelta(draft, 0.15, false);
      });

      const virtualFrames = computeVirtualFrames(mockState.tracks, mockState.dragState);
      const virtualReference = virtualFrames.find((f) => f.points.some((p) => p.id === "point2"));

      expect(virtualReference).toBeDefined();
      expect(virtualReference?.stamp).toBe(0.35); // 0.2 + 0.15

      // Check reference marker comparison during drag
      const isReferenceDuringDrag = mockState.dragState?.isDragging
        ? compareInstancedFramesIgnoringStamp(referenceFrame, virtualReference!) ===
          FrameComparison.Equal
        : compareInstancedFrames(referenceFrame, virtualReference!) === FrameComparison.Equal;

      expect(isReferenceDuringDrag).toBe(true);
    });
  });

  describe("Selection Update After Commit", () => {
    it("should update selection with new positions after commit", () => {
      // Set initial selection
      const selectedFrames: InstancedFrameInfo[] = [
        {
          id: "point1",
          stamp: 0.1,
          points: [{ id: "point1", trackId: "track1", value: 10 }],
        },
        {
          id: "point2",
          stamp: 0.2,
          points: [{ id: "point2", trackId: "track1", value: 20 }],
        },
      ];
      mockState.selection = selectedFrames;

      // Perform drag operation
      mockState = produce(mockState, (draft) => {
        startDragging(draft);
        updateDragDelta(draft, 0.05, false);
        commitDrag(draft);
      });

      // Selection should be updated with new positions
      expect(mockState.selection.length).toBe(2);
      expect(mockState.selection[0].stamp).toBe(0.15); // 0.1 + 0.05
      expect(mockState.selection[1].stamp).toBe(0.25); // 0.2 + 0.05

      // Point IDs should remain the same
      expect(mockState.selection[0].points[0].id).toBe("point1");
      expect(mockState.selection[1].points[0].id).toBe("point2");

      // Drag state should be cleared
      expect(mockState.dragState).toBeNull();
    });

    it("should maintain selection after cancel", () => {
      const selectedFrame: InstancedFrameInfo = {
        id: "point1",
        stamp: 0.1,
        points: [{ id: "point1", trackId: "track1", value: 10 }],
      };
      mockState.selection = [selectedFrame];

      // Start drag and cancel
      mockState = produce(mockState, (draft) => {
        startDragging(draft);
        updateDragDelta(draft, 0.05, false);
        cancelDrag(draft);
      });

      // Selection should remain at original position
      expect(mockState.selection).toEqual([selectedFrame]);
      expect(mockState.selection[0].stamp).toBe(0.1);

      // Drag state should be cleared
      expect(mockState.dragState).toBeNull();
    });

    it("should handle multi-track selection update after commit", () => {
      // Multi-track selection at same timestamp
      const multiTrackFrame: InstancedFrameInfo = {
        id: "point1",
        stamp: 0.1,
        points: [
          { id: "point1", trackId: "track1", value: 10 },
          { id: "point4", trackId: "track2", value: 15 },
        ],
      };
      mockState.selection = [multiTrackFrame];

      // Perform drag
      mockState = produce(mockState, (draft) => {
        startDragging(draft);
        updateDragDelta(draft, 0.08, false);
        commitDrag(draft);
      });

      // Selection should be updated
      expect(mockState.selection.length).toBe(1);
      expect(mockState.selection[0].stamp).toBe(0.18); // 0.1 + 0.08
      expect(mockState.selection[0].points.length).toBe(2);

      // Both track points should still be present
      const hasTrack1 = mockState.selection[0].points.some((p) => p.trackId === "track1");
      const hasTrack2 = mockState.selection[0].points.some((p) => p.trackId === "track2");
      expect(hasTrack1).toBe(true);
      expect(hasTrack2).toBe(true);
    });
  });

  describe("Virtual Frames During Drag", () => {
    it("should show selected markers at virtual positions during drag", () => {
      const selectedFrames: InstancedFrameInfo[] = [
        {
          id: "point1",
          stamp: 0.1,
          points: [{ id: "point1", trackId: "track1", value: 10 }],
        },
        {
          id: "point3",
          stamp: 0.3,
          points: [{ id: "point3", trackId: "track1", value: 30 }],
        },
      ];
      mockState.selection = selectedFrames;

      // Start dragging and apply delta
      mockState = produce(mockState, (draft) => {
        startDragging(draft);
        updateDragDelta(draft, 0.12, false);
      });

      // Get virtual frames
      const virtualFrames = computeVirtualFrames(mockState.tracks, mockState.dragState);

      // Find the dragged frames at their new positions
      const draggedFrame1 = virtualFrames.find((f) => f.points.some((p) => p.id === "point1"));
      const draggedFrame3 = virtualFrames.find((f) => f.points.some((p) => p.id === "point3"));

      // Virtual positions should reflect the drag offset
      expect(draggedFrame1?.stamp).toBe(0.22); // 0.1 + 0.12
      expect(draggedFrame3?.stamp).toBe(0.42); // 0.3 + 0.12

      // Non-dragged frame should remain at original position
      const nonDraggedFrame2 = virtualFrames.find((f) => f.points.some((p) => p.id === "point2"));
      expect(nonDraggedFrame2?.stamp).toBe(0.2); // Unchanged

      // Original selection should still be intact during drag
      expect(mockState.selection).toEqual(selectedFrames);
    });

    it("should maintain relative positions in multi-selection", () => {
      const selectedFrames: InstancedFrameInfo[] = [
        {
          id: "point1",
          stamp: 0.1,
          points: [{ id: "point1", trackId: "track1", value: 10 }],
        },
        {
          id: "point2",
          stamp: 0.2,
          points: [{ id: "point2", trackId: "track1", value: 20 }],
        },
        {
          id: "point3",
          stamp: 0.3,
          points: [{ id: "point3", trackId: "track1", value: 30 }],
        },
      ];
      mockState.selection = selectedFrames;

      // Drag all selected frames
      mockState = produce(mockState, (draft) => {
        startDragging(draft);
        updateDragDelta(draft, 0.025, false);
      });

      const virtualFrames = computeVirtualFrames(mockState.tracks, mockState.dragState);

      const vFrame1 = virtualFrames.find((f) => f.points.some((p) => p.id === "point1"));
      const vFrame2 = virtualFrames.find((f) => f.points.some((p) => p.id === "point2"));
      const vFrame3 = virtualFrames.find((f) => f.points.some((p) => p.id === "point3"));

      // All frames should move by the same amount
      expect(vFrame1?.stamp).toBe(0.125); // 0.1 + 0.025
      expect(vFrame2?.stamp).toBe(0.225); // 0.2 + 0.025
      expect(vFrame3?.stamp).toBe(0.325); // 0.3 + 0.025

      // Verify relative distances are maintained
      const distance1to2 = (vFrame2?.stamp ?? 0) - (vFrame1?.stamp ?? 0);
      const distance2to3 = (vFrame3?.stamp ?? 0) - (vFrame2?.stamp ?? 0);
      expect(distance1to2).toBeCloseTo(0.1, 5);
      expect(distance2to3).toBeCloseTo(0.1, 5);
    });
  });

  describe("Edge Cases", () => {
    it("should handle boundary conditions with clamping", () => {
      const selectedFrame: InstancedFrameInfo = {
        id: "point1",
        stamp: 0.1,
        points: [{ id: "point1", trackId: "track1", value: 10 }],
      };
      mockState.selection = [selectedFrame];

      // Try to drag beyond boundaries
      mockState = produce(mockState, (draft) => {
        startDragging(draft);
        updateDragDelta(draft, -0.2, false); // Would result in -0.1
      });

      const virtualFrames = computeVirtualFrames(mockState.tracks, mockState.dragState);
      const virtualFrame = virtualFrames.find((f) => f.points.some((p) => p.id === "point1"));

      // Should be clamped to 0
      expect(virtualFrame?.stamp).toBe(0);
    });

    it("should handle drag near 1.0 boundary", () => {
      const selectedFrame: InstancedFrameInfo = {
        id: "point3",
        stamp: 0.3,
        points: [{ id: "point3", trackId: "track1", value: 30 }],
      };
      mockState.selection = [selectedFrame];

      mockState = produce(mockState, (draft) => {
        startDragging(draft);
        updateDragDelta(draft, 0.8, false); // Would result in 1.1
      });

      const virtualFrames = computeVirtualFrames(mockState.tracks, mockState.dragState);
      const virtualFrame = virtualFrames.find((f) => f.points.some((p) => p.id === "point3"));

      // Should be clamped to 1
      expect(virtualFrame?.stamp).toBe(1);
    });

    it("should handle empty selection gracefully", () => {
      mockState.selection = [];

      // Starting drag with no selection should do nothing
      mockState = produce(mockState, (draft) => {
        startDragging(draft, []);
      });
      expect(mockState.dragState).toBeNull();
    });
  });
});
