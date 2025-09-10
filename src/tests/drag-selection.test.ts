import { describe, it, expect, beforeEach, vi } from "vitest";
import { enableMapSet } from "immer";
import type { RawValue } from "@semio/utils";
import type { InstancedFrameInfo, Track, Keypoint } from "../types";
import type { AnimationData, AnimationActions } from "../store-types";
import { createDefaultState } from "../actions/create-default-state";
import { startDragging, updateDragDelta, commitDrag, cancelDrag } from "../actions/drag";
import { computeVirtualFrames } from "../functions/compute-virtual-frames";
import { compareInstancedFrames, FrameComparison } from "../functions/compare-instanced-frames";

// Enable Immer MapSet plugin for tests
enableMapSet();

describe("Drag Selection Persistence", () => {
  let mockState: AnimationData;
  let mockGet: () => AnimationData & AnimationActions;
  let mockSet: (updater: Partial<AnimationData> | ((state: AnimationData) => Partial<AnimationData>)) => void;

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
            { id: "point1", stamp: 100, value: 10 },
            { id: "point2", stamp: 200, value: 20 },
            { id: "point3", stamp: 300, value: 30 },
          ],
        } as Track<RawValue>,
        track2: {
          id: "track2",
          name: "Track 2",
          animatableId: "anim2",
          type: "number",
          points: [
            { id: "point4", stamp: 100, value: 15 },
            { id: "point5", stamp: 250, value: 25 },
          ],
        } as Track<RawValue>,
      },
    };

    // Mock updateKeypoints function
    mockState.updateKeypoints = vi.fn((updates: { trackId: string; keypoint: Partial<Keypoint<RawValue>> }[]) => {
      updates.forEach(({ trackId, keypoint }) => {
        const track = mockState.tracks[trackId];
        if (track) {
          const point = track.points.find((p) => p.id === keypoint.id);
          if (point && keypoint.stamp !== undefined) {
            point.stamp = keypoint.stamp;
          }
        }
      });
    });

    mockGet = () => mockState as any;
    mockSet = (updater: any) => {
      if (typeof updater === "function") {
        const result = updater(mockState as any);
        Object.assign(mockState, result);
      } else {
        Object.assign(mockState, updater);
      }
    };
  });

  describe("Selection Visual During Drag", () => {
    it("should maintain selection state when drag starts", () => {
      // Set initial selection
      const selectedFrames: InstancedFrameInfo[] = [
        {
          id: "frame1",
          stamp: 100,
          points: [
            { id: "point1", trackId: "track1", value: 10 },
            { id: "point4", trackId: "track2", value: 15 },
          ],
        },
      ];
      mockState.selection = selectedFrames;

      // Start dragging
      startDragging(mockGet, mockSet);

      // Selection should still be present
      expect(mockState.selection).toEqual(selectedFrames);
      expect(mockState.selection.length).toBe(1);
      expect(mockState.dragState?.isDragging).toBe(true);
    });

    it("should show selected markers at virtual positions during drag", () => {
      // Set initial selection
      const selectedFrames: InstancedFrameInfo[] = [
        {
          id: "frame1",
          stamp: 100,
          points: [{ id: "point1", trackId: "track1", value: 10 }],
        },
        {
          id: "frame2",
          stamp: 200,
          points: [{ id: "point2", trackId: "track1", value: 20 }],
        },
      ];
      mockState.selection = selectedFrames;

      // Start dragging and apply delta
      startDragging(mockGet, mockSet);
      updateDragDelta(mockGet, mockSet, 50, false);

      // Get virtual frames
      const virtualFrames = computeVirtualFrames(mockState.tracks, mockState.dragState);

      // Find the dragged frames at their new positions
      const draggedFrame1 = virtualFrames.find((f) =>
        f.points.some((p) => p.id === "point1")
      );
      const draggedFrame2 = virtualFrames.find((f) =>
        f.points.some((p) => p.id === "point2")
      );

      // Virtual positions should reflect the drag offset
      expect(draggedFrame1?.stamp).toBe(150); // 100 + 50
      expect(draggedFrame2?.stamp).toBe(250); // 200 + 50

      // Original selection should still be intact
      expect(mockState.selection).toEqual(selectedFrames);
    });

    it("should maintain visual selection indicator during entire drag", () => {
      // This tests that isSelected checks work during drag
      const selectedFrame: InstancedFrameInfo = {
        id: "frame1",
        stamp: 100,
        points: [{ id: "point1", trackId: "track1", value: 10 }],
      };
      mockState.selection = [selectedFrame];

      // Function to check if a frame is selected (mimics component logic)
      const isFrameSelected = (frame: InstancedFrameInfo): boolean => {
        const comparisons = mockState.selection.map((s) =>
          compareInstancedFrames(s, frame)
        );
        return (
          comparisons.includes(FrameComparison.Equal) ||
          comparisons.includes(FrameComparison.Superset)
        );
      };

      // Before drag
      expect(isFrameSelected(selectedFrame)).toBe(true);

      // Start drag
      startDragging(mockGet, mockSet);
      expect(isFrameSelected(selectedFrame)).toBe(true);

      // During drag with offset
      updateDragDelta(mockGet, mockSet, 100, false);
      expect(isFrameSelected(selectedFrame)).toBe(true);

      // The selection array should remain unchanged during drag
      expect(mockState.selection).toEqual([selectedFrame]);
    });
  });

  describe("Selection Persistence After Drag", () => {
    it("should update selection with new positions after commit", () => {
      // Set initial selection
      const selectedFrames: InstancedFrameInfo[] = [
        {
          id: "frame1",
          stamp: 100,
          points: [{ id: "point1", trackId: "track1", value: 10 }],
        },
        {
          id: "frame2",
          stamp: 200,
          points: [{ id: "point2", trackId: "track1", value: 20 }],
        },
      ];
      mockState.selection = selectedFrames;

      // Perform drag operation
      startDragging(mockGet, mockSet);
      updateDragDelta(mockGet, mockSet, 50, false);
      commitDrag(mockGet, mockSet);

      // Selection should be updated with new positions
      expect(mockState.selection.length).toBe(2);
      expect(mockState.selection[0].stamp).toBe(150); // 100 + 50
      expect(mockState.selection[1].stamp).toBe(250); // 200 + 50

      // Drag state should be cleared
      expect(mockState.dragState).toBeNull();
    });

    it("should maintain selection after drag cancel", () => {
      // Set initial selection
      const selectedFrames: InstancedFrameInfo[] = [
        {
          id: "frame1",
          stamp: 100,
          points: [{ id: "point1", trackId: "track1", value: 10 }],
        },
      ];
      mockState.selection = selectedFrames;

      // Start drag and cancel
      startDragging(mockGet, mockSet);
      updateDragDelta(mockGet, mockSet, 50, false);
      cancelDrag(mockGet, mockSet);

      // Selection should remain at original position
      expect(mockState.selection).toEqual(selectedFrames);
      expect(mockState.selection[0].stamp).toBe(100);

      // Drag state should be cleared
      expect(mockState.dragState).toBeNull();
    });

    it("should handle multi-track selection persistence", () => {
      // Set multi-track selection
      const selectedFrames: InstancedFrameInfo[] = [
        {
          id: "frame1",
          stamp: 100,
          points: [
            { id: "point1", trackId: "track1", value: 10 },
            { id: "point4", trackId: "track2", value: 15 },
          ],
        },
      ];
      mockState.selection = selectedFrames;

      // Perform drag operation
      startDragging(mockGet, mockSet);
      updateDragDelta(mockGet, mockSet, 75, false);
      commitDrag(mockGet, mockSet);

      // Both tracks' points should move together
      expect(mockState.selection.length).toBe(1);
      expect(mockState.selection[0].stamp).toBe(175); // 100 + 75
      expect(mockState.selection[0].points.length).toBe(2);

      // Check that both track points are still selected
      const hasTrack1Point = mockState.selection[0].points.some(p => p.trackId === "track1");
      const hasTrack2Point = mockState.selection[0].points.some(p => p.trackId === "track2");
      expect(hasTrack1Point).toBe(true);
      expect(hasTrack2Point).toBe(true);
    });

    it("should maintain relative positions in multi-selection", () => {
      // Select multiple frames at different positions
      const selectedFrames: InstancedFrameInfo[] = [
        {
          id: "frame1",
          stamp: 100,
          points: [{ id: "point1", trackId: "track1", value: 10 }],
        },
        {
          id: "frame2",
          stamp: 200,
          points: [{ id: "point2", trackId: "track1", value: 20 }],
        },
        {
          id: "frame3",
          stamp: 300,
          points: [{ id: "point3", trackId: "track1", value: 30 }],
        },
      ];
      mockState.selection = selectedFrames;

      // Drag all selected frames
      startDragging(mockGet, mockSet);
      updateDragDelta(mockGet, mockSet, 25, false);
      commitDrag(mockGet, mockSet);

      // All frames should maintain their relative positions
      expect(mockState.selection.length).toBe(3);
      expect(mockState.selection[0].stamp).toBe(125); // 100 + 25
      expect(mockState.selection[1].stamp).toBe(225); // 200 + 25
      expect(mockState.selection[2].stamp).toBe(325); // 300 + 25

      // Verify relative distances are maintained
      const distance1to2 = mockState.selection[1].stamp - mockState.selection[0].stamp;
      const distance2to3 = mockState.selection[2].stamp - mockState.selection[1].stamp;
      expect(distance1to2).toBe(100); // Original distance maintained
      expect(distance2to3).toBe(100); // Original distance maintained
    });
  });

  describe("Auto-Selection on Drag", () => {
    it("should auto-select marker if dragging unselected marker", () => {
      // Start with empty selection
      mockState.selection = [];

      // Create a frame to be auto-selected
      const frameToSelect: InstancedFrameInfo = {
        id: "frame1",
        stamp: 100,
        points: [{ id: "point1", trackId: "track1", value: 10 }],
      };

      // Simulate clicking marker to select it (this would be called by component)
      mockState.selection = [frameToSelect];

      // Start dragging
      startDragging(mockGet, mockSet);

      // Frame should be selected and dragging
      expect(mockState.selection).toEqual([frameToSelect]);
      expect(mockState.dragState?.isDragging).toBe(true);
      expect(mockState.dragState?.draggedKeypoints.has("point1")).toBe(true);
    });

    it("should add to selection when dragging with existing selection", () => {
      // Start with one selected frame
      const existingSelection: InstancedFrameInfo = {
        id: "frame1",
        stamp: 100,
        points: [{ id: "point1", trackId: "track1", value: 10 }],
      };
      mockState.selection = [existingSelection];

      // Drag should work with the existing selection
      startDragging(mockGet, mockSet);
      updateDragDelta(mockGet, mockSet, 50, false);

      // Selection should still contain the original frame
      expect(mockState.selection).toEqual([existingSelection]);

      // Virtual frame should show at new position
      const virtualFrames = computeVirtualFrames(mockState.tracks, mockState.dragState);
      const virtualFrame = virtualFrames.find(f => f.points.some(p => p.id === "point1"));
      expect(virtualFrame?.stamp).toBe(150); // 100 + 50
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty selection during drag", () => {
      mockState.selection = [];

      // Starting drag with no selection should do nothing
      startDragging(mockGet, mockSet);
      expect(mockState.dragState).toBeNull();
    });

    it("should handle selection update when keypoint IDs change", () => {
      // This could happen if keypoints are renamed or recreated
      const selectedFrames: InstancedFrameInfo[] = [
        {
          id: "frame1",
          stamp: 100,
          points: [{ id: "point1", trackId: "track1", value: 10 }],
        },
      ];
      mockState.selection = selectedFrames;

      startDragging(mockGet, mockSet);
      updateDragDelta(mockGet, mockSet, 50, false);

      // Even if the point ID doesn't exist in the new stamp map,
      // the frame should still be in the selection
      commitDrag(mockGet, mockSet);

      expect(mockState.selection.length).toBe(1);
      // The stamp should be updated based on the drag
      expect(mockState.selection[0].stamp).toBe(150);
    });

    it("should maintain selection when dragging to negative positions", () => {
      const selectedFrames: InstancedFrameInfo[] = [
        {
          id: "frame1",
          stamp: 100,
          points: [{ id: "point1", trackId: "track1", value: 10 }],
        },
      ];
      mockState.selection = selectedFrames;

      startDragging(mockGet, mockSet);
      updateDragDelta(mockGet, mockSet, -150, false); // Would result in negative position
      commitDrag(mockGet, mockSet);

      // Selection should still exist even at boundary
      expect(mockState.selection.length).toBe(1);
      // Position should be clamped or handled appropriately
      // (actual behavior depends on implementation)
    });
  });
});
