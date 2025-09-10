import { describe, it, expect, beforeEach } from "vitest";
import { enableMapSet, produce } from "immer";
import type { RawValue } from "@semio/utils";
import type { Track } from "../../types";
import type { AnimationData } from "../../store-types";
import { createDefaultState } from "../../actions/create-default-state";
import { startDragging, updateDragDelta, commitDrag } from "../../actions/drag";
import { computeFrames } from "../../functions/compute-frames";

// Enable Immer MapSet plugin for tests
enableMapSet();

describe("Drag Release Selection Persistence", () => {
  let mockState: AnimationData;

  beforeEach(() => {
    // Initialize mock state with multiple tracks and markers
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
            { id: "point1", stamp: 0.1, value: 10 },
            { id: "point2", stamp: 0.3, value: 20 },
            { id: "point3", stamp: 0.5, value: 30 },
            { id: "point4", stamp: 0.7, value: 40 },
          ],
        } as Track<RawValue>,
        track2: {
          id: "track2",
          name: "Track 2",
          animatableId: "anim2",
          points: [
            { id: "point5", stamp: 0.2, value: 50 },
            { id: "point6", stamp: 0.4, value: 60 },
            { id: "point7", stamp: 0.6, value: 70 },
            { id: "point8", stamp: 0.8, value: 80 },
          ],
        } as Track<RawValue>,
        track3: {
          id: "track3",
          name: "Track 3",
          animatableId: "anim3",
          points: [
            { id: "point9", stamp: 0.1, value: 90 },
            { id: "point10", stamp: 0.3, value: 100 },
            { id: "point11", stamp: 0.5, value: 110 },
            { id: "point12", stamp: 0.9, value: 120 },
          ],
        } as Track<RawValue>,
      },
    };
  });

  describe("Issue: Selection lost after drag completion", () => {
    it("should maintain ALL selected markers after dragging and releasing in empty space", () => {
      const initialFrames = computeFrames(mockState.tracks);

      // Select multiple frames across different tracks
      // Frame at 0.1 (point1 + point9)
      const frame01 = initialFrames.find((f) => Math.abs(f.stamp - 0.1) < 0.001);
      expect(frame01).toBeDefined();
      expect(frame01?.points.length).toBe(2); // point1 and point9

      // Frame at 0.3 (point2 + point10)
      const frame03 = initialFrames.find((f) => Math.abs(f.stamp - 0.3) < 0.001);
      expect(frame03).toBeDefined();
      expect(frame03?.points.length).toBe(2); // point2 and point10

      // Frame at 0.5 (point3 + point11)
      const frame05 = initialFrames.find((f) => Math.abs(f.stamp - 0.5) < 0.001);
      expect(frame05).toBeDefined();
      expect(frame05?.points.length).toBe(2); // point3 and point11

      // Select all three frames
      mockState.selection = [frame01!, frame03!, frame05!];
      expect(mockState.selection.length).toBe(3);

      // Store the IDs of all selected points for verification
      const selectedPointIds = new Set<string>();
      mockState.selection.forEach((frame) => {
        frame.points.forEach((point) => {
          selectedPointIds.add(point.id);
        });
      });
      expect(selectedPointIds.size).toBe(6); // 3 frames * 2 points each

      // Drag all selected markers to an empty space (e.g., by 0.05)
      mockState = produce(mockState, (draft) => {
        startDragging(draft);
        updateDragDelta(draft, 0.05, false);
        commitDrag(draft);
      });

      // IMPORTANT: After drag completion, ALL originally selected markers should remain selected
      expect(mockState.selection.length).toBe(3); // All 3 frames should still be selected

      // Verify all originally selected points are still in the selection
      const newSelectedPointIds = new Set<string>();
      mockState.selection.forEach((frame) => {
        frame.points.forEach((point) => {
          newSelectedPointIds.add(point.id);
        });
      });

      // All originally selected points should still be selected
      selectedPointIds.forEach((id) => {
        expect(newSelectedPointIds.has(id)).toBe(true);
      });

      // Verify the new positions
      expect(mockState.selection.some((f) => Math.abs(f.stamp - 0.15) < 0.001)).toBe(true); // 0.1 + 0.05
      expect(mockState.selection.some((f) => Math.abs(f.stamp - 0.35) < 0.001)).toBe(true); // 0.3 + 0.05
      expect(mockState.selection.some((f) => Math.abs(f.stamp - 0.55) < 0.001)).toBe(true); // 0.5 + 0.05
    });

    it("should maintain selection even when only one marker is actively dragged from multi-selection", () => {
      const initialFrames = computeFrames(mockState.tracks);

      // Select multiple frames
      const frame02 = initialFrames.find((f) => Math.abs(f.stamp - 0.2) < 0.001);
      const frame04 = initialFrames.find((f) => Math.abs(f.stamp - 0.4) < 0.001);
      const frame06 = initialFrames.find((f) => Math.abs(f.stamp - 0.6) < 0.001);

      expect(frame02).toBeDefined();
      expect(frame04).toBeDefined();
      expect(frame06).toBeDefined();

      mockState.selection = [frame02!, frame04!, frame06!];
      expect(mockState.selection.length).toBe(3);

      // Simulate dragging where user clicks on one marker but all selected markers should move
      mockState = produce(mockState, (draft) => {
        // Start dragging with the current selection (simulating click on one of the selected markers)
        startDragging(draft);

        // Move by 0.1
        updateDragDelta(draft, 0.1, false);

        // Complete the drag
        commitDrag(draft);
      });

      // All three frames should STILL be selected after drag completion
      expect(mockState.selection.length).toBe(3);

      // Verify new positions
      expect(mockState.selection.some((f) => Math.abs(f.stamp - 0.3) < 0.001)).toBe(true); // 0.2 + 0.1
      expect(mockState.selection.some((f) => Math.abs(f.stamp - 0.5) < 0.001)).toBe(true); // 0.4 + 0.1
      expect(mockState.selection.some((f) => Math.abs(f.stamp - 0.7) < 0.001)).toBe(true); // 0.6 + 0.1
    });

    it("should maintain multi-track selection after drag even with single-point frames", () => {
      const initialFrames = computeFrames(mockState.tracks);

      // Select frames that have different numbers of points
      const frame02 = initialFrames.find((f) => Math.abs(f.stamp - 0.2) < 0.001); // point5 only
      const frame03 = initialFrames.find((f) => Math.abs(f.stamp - 0.3) < 0.001); // point2 + point10
      const frame08 = initialFrames.find((f) => Math.abs(f.stamp - 0.8) < 0.001); // point8 only

      expect(frame02?.points.length).toBe(1);
      expect(frame03?.points.length).toBe(2);
      expect(frame08?.points.length).toBe(1);

      mockState.selection = [frame02!, frame03!, frame08!];

      // Store original selected point IDs
      const originalSelectedIds = new Set<string>();
      mockState.selection.forEach((frame) => {
        frame.points.forEach((point) => {
          originalSelectedIds.add(point.id);
        });
      });
      expect(originalSelectedIds.size).toBe(4); // 1 + 2 + 1 points

      // Drag the selection
      mockState = produce(mockState, (draft) => {
        startDragging(draft);
        updateDragDelta(draft, -0.1, false); // Move backward
        commitDrag(draft);
      });

      // All frames should remain selected
      expect(mockState.selection.length).toBe(3);

      // Verify all original points are still selected
      const newSelectedIds = new Set<string>();
      mockState.selection.forEach((frame) => {
        frame.points.forEach((point) => {
          newSelectedIds.add(point.id);
        });
      });

      originalSelectedIds.forEach((id) => {
        expect(newSelectedIds.has(id)).toBe(true);
      });
    });

    it("should handle selection persistence when dragging to position where frames don't merge", () => {
      const initialFrames = computeFrames(mockState.tracks);

      // Select non-adjacent frames
      const frame01 = initialFrames.find((f) => Math.abs(f.stamp - 0.1) < 0.001);
      const frame05 = initialFrames.find((f) => Math.abs(f.stamp - 0.5) < 0.001);
      const frame09 = initialFrames.find((f) => Math.abs(f.stamp - 0.9) < 0.001);

      mockState.selection = [frame01!, frame05!, frame09!];
      const initialSelectionCount = mockState.selection.length;
      expect(initialSelectionCount).toBe(3);

      // Drag by small amount that won't cause merging
      mockState = produce(mockState, (draft) => {
        startDragging(draft);
        updateDragDelta(draft, 0.02, false);
        commitDrag(draft);
      });

      // Selection count should be maintained
      expect(mockState.selection.length).toBe(initialSelectionCount);

      // Verify positions
      expect(mockState.selection.some((f) => Math.abs(f.stamp - 0.12) < 0.001)).toBe(true);
      expect(mockState.selection.some((f) => Math.abs(f.stamp - 0.52) < 0.001)).toBe(true);
      expect(mockState.selection.some((f) => Math.abs(f.stamp - 0.92) < 0.001)).toBe(true);
    });
  });
});
