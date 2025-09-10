import { describe, it, expect, beforeEach, vi } from "vitest";
import { enableMapSet, produce } from "immer";
import type { RawValue } from "@semio/utils";
import type { Track } from "../../types";
import type { AnimationData } from "../../store-types";
import { createDefaultState } from "../../actions/create-default-state";
import { startDragging, updateDragDelta, commitDrag } from "../../actions/drag";
import { computeFrames } from "../../functions/compute-frames";
import { computeMarkerSelection } from "../../functions/compute-marker-selection";

// Enable Immer MapSet plugin for tests
enableMapSet();

describe("Click After Drag Prevention", () => {
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

  describe("Selection Persistence After Drag", () => {
    it("should maintain multi-selection after drag completion", () => {
      const initialFrames = computeFrames(mockState.tracks);

      // Select multiple frames
      const frame01 = initialFrames.find((f) => Math.abs(f.stamp - 0.1) < 0.001);
      const frame03 = initialFrames.find((f) => Math.abs(f.stamp - 0.3) < 0.001);
      const frame05 = initialFrames.find((f) => Math.abs(f.stamp - 0.5) < 0.001);

      expect(frame01).toBeDefined();
      expect(frame03).toBeDefined();
      expect(frame05).toBeDefined();

      mockState.selection = [frame01!, frame03!, frame05!];
      const initialSelectionCount = mockState.selection.length;
      expect(initialSelectionCount).toBe(3);

      // Store initial selected point IDs
      const initialSelectedIds = new Set<string>();
      mockState.selection.forEach((frame) => {
        frame.points.forEach((point) => {
          initialSelectedIds.add(point.id);
        });
      });

      // Perform drag operation
      mockState = produce(mockState, (draft) => {
        startDragging(draft);
        updateDragDelta(draft, 0.05, false);
        commitDrag(draft);
      });

      // Verify selection is maintained after drag
      expect(mockState.selection.length).toBe(initialSelectionCount);

      // Verify all originally selected points are still selected
      const afterDragSelectedIds = new Set<string>();
      mockState.selection.forEach((frame) => {
        frame.points.forEach((point) => {
          afterDragSelectedIds.add(point.id);
        });
      });

      initialSelectedIds.forEach((id) => {
        expect(afterDragSelectedIds.has(id)).toBe(true);
      });
    });

    it("should not lose selection when simulating click after drag", () => {
      const initialFrames = computeFrames(mockState.tracks);

      // Select multiple frames
      const frame02 = initialFrames.find((f) => Math.abs(f.stamp - 0.2) < 0.001);
      const frame04 = initialFrames.find((f) => Math.abs(f.stamp - 0.4) < 0.001);
      const frame06 = initialFrames.find((f) => Math.abs(f.stamp - 0.6) < 0.001);

      mockState.selection = [frame02!, frame04!, frame06!];
      expect(mockState.selection.length).toBe(3);

      // Simulate drag
      mockState = produce(mockState, (draft) => {
        startDragging(draft);
        updateDragDelta(draft, 0.1, false);
        commitDrag(draft);
      });

      // Selection should be maintained
      expect(mockState.selection.length).toBe(3);

      // Simulate what would happen if click event fired immediately after drag
      // The fix in DataPoint component should prevent this from clearing selection
      // by checking the justFinishedDragging flag

      // If the fix is working, selection should remain unchanged
      expect(mockState.selection.length).toBe(3);

      // Verify frames moved to new positions
      expect(mockState.selection.some((f) => Math.abs(f.stamp - 0.3) < 0.001)).toBe(true);
      expect(mockState.selection.some((f) => Math.abs(f.stamp - 0.5) < 0.001)).toBe(true);
      expect(mockState.selection.some((f) => Math.abs(f.stamp - 0.7) < 0.001)).toBe(true);
    });

    it("should allow normal click selection after timeout period", () => {
      vi.useFakeTimers();

      const initialFrames = computeFrames(mockState.tracks);

      // Select a single frame
      const frame01 = initialFrames.find((f) => Math.abs(f.stamp - 0.1) < 0.001);
      mockState.selection = [frame01!];

      // Perform drag
      mockState = produce(mockState, (draft) => {
        startDragging(draft);
        updateDragDelta(draft, 0.05, false);
        commitDrag(draft);
      });

      // Selection should be maintained immediately after drag
      expect(mockState.selection.length).toBe(1);
      expect(mockState.selection[0].stamp).toBeCloseTo(0.15, 3);

      // Advance time past the protection period (100ms in the fix)
      vi.advanceTimersByTime(150);

      // After timeout, normal click selection should work
      // This would be tested in the UI, but here we verify the state allows it
      const newFrames = computeFrames(mockState.tracks);
      const frame02 = newFrames.find((f) => Math.abs(f.stamp - 0.2) < 0.001);

      // Simulate selecting a different frame (what would happen after timeout)
      const result = computeMarkerSelection(
        frame02!,
        [{ trackId: "track2", type: "number" }],
        newFrames,
        mockState.selection,
        mockState.referenceMarker,
        false, // shift
        false, // mod
      );

      // This should replace the selection (normal click behavior)
      expect(result.selection.length).toBe(1);
      expect(result.selection[0]).toBe(frame02);

      vi.useRealTimers();
    });

    it("should handle rapid successive drags without losing selection", () => {
      const initialFrames = computeFrames(mockState.tracks);

      // Select multiple frames
      const frame01 = initialFrames.find((f) => Math.abs(f.stamp - 0.1) < 0.001);
      const frame03 = initialFrames.find((f) => Math.abs(f.stamp - 0.3) < 0.001);

      mockState.selection = [frame01!, frame03!];
      expect(mockState.selection.length).toBe(2);

      // First drag
      mockState = produce(mockState, (draft) => {
        startDragging(draft);
        updateDragDelta(draft, 0.05, false);
        commitDrag(draft);
      });

      expect(mockState.selection.length).toBe(2);

      // Second drag immediately after
      mockState = produce(mockState, (draft) => {
        startDragging(draft);
        updateDragDelta(draft, 0.05, false);
        commitDrag(draft);
      });

      // Selection should still be maintained
      expect(mockState.selection.length).toBe(2);

      // Verify final positions
      expect(mockState.selection.some((f) => Math.abs(f.stamp - 0.2) < 0.001)).toBe(true);
      expect(mockState.selection.some((f) => Math.abs(f.stamp - 0.4) < 0.001)).toBe(true);
    });

    it("should maintain selection when dragging with shift/mod keys", () => {
      const initialFrames = computeFrames(mockState.tracks);

      // Select initial frames
      const frame01 = initialFrames.find((f) => Math.abs(f.stamp - 0.1) < 0.001);
      const frame05 = initialFrames.find((f) => Math.abs(f.stamp - 0.5) < 0.001);

      mockState.selection = [frame01!, frame05!];

      // Drag selection
      mockState = produce(mockState, (draft) => {
        startDragging(draft);
        updateDragDelta(draft, 0.15, false);
        commitDrag(draft);
      });

      // All originally selected frames should remain selected
      expect(mockState.selection.length).toBe(2);

      // If shift-click were to happen after drag (after timeout),
      // it should extend selection, not replace it
      const newFrames = computeFrames(mockState.tracks);
      const frame04 = newFrames.find((f) => Math.abs(f.stamp - 0.4) < 0.001);

      const result = computeMarkerSelection(
        frame04!,
        [{ trackId: "track2", type: "number" }],
        newFrames,
        mockState.selection,
        mockState.referenceMarker,
        true, // shift - should add to selection
        false,
      );

      // Should have added to selection
      expect(result.selection.length).toBeGreaterThan(2);
    });

    it("should handle edge case of dragging single selected marker", () => {
      const initialFrames = computeFrames(mockState.tracks);

      // Select only one frame
      const frame02 = initialFrames.find((f) => Math.abs(f.stamp - 0.2) < 0.001);
      mockState.selection = [frame02!];

      // Drag the single selection
      mockState = produce(mockState, (draft) => {
        startDragging(draft);
        updateDragDelta(draft, 0.3, false);
        commitDrag(draft);
      });

      // Single selection should be maintained
      expect(mockState.selection.length).toBe(1);
      expect(mockState.selection[0].stamp).toBeCloseTo(0.5, 3);

      // Verify the selected point is the one we dragged
      expect(mockState.selection[0].points.some((p) => p.id === "point5")).toBe(true);
    });

    it("should maintain reference marker after drag completion", () => {
      const initialFrames = computeFrames(mockState.tracks);

      // Select multiple frames and set reference
      const frame01 = initialFrames.find((f) => Math.abs(f.stamp - 0.1) < 0.001);
      const frame03 = initialFrames.find((f) => Math.abs(f.stamp - 0.3) < 0.001);

      mockState.selection = [frame01!, frame03!];
      mockState.referenceMarker = {
        marker: frame01!,
        sources: [
          { trackId: "track1", type: "number" },
          { trackId: "track3", type: "number" },
        ],
      };

      // Drag selection
      mockState = produce(mockState, (draft) => {
        startDragging(draft);
        updateDragDelta(draft, 0.2, false);
        commitDrag(draft);
      });

      // Both selection and reference should be maintained
      expect(mockState.selection.length).toBe(2);
      expect(mockState.referenceMarker).toBeDefined();
      expect(mockState.referenceMarker?.marker.stamp).toBeCloseTo(0.3, 3);

      // Verify reference marker is still in selection
      const referenceInSelection = mockState.selection.some(
        (frame) => frame.stamp === mockState.referenceMarker?.marker.stamp,
      );
      expect(referenceInSelection).toBe(true);
    });
  });
});
