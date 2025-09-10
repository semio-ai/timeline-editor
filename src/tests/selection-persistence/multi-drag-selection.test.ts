import { describe, it, expect, beforeEach } from "vitest";
import { enableMapSet, produce } from "immer";
import type { RawValue } from "@semio/utils";
import type { Track } from "../../types";
import type { AnimationData, AnimationActions } from "../../store-types";
import { createDefaultState } from "../../actions/create-default-state";
import { startDragging, updateDragDelta, commitDrag } from "../../actions/drag";
import { computeFrames } from "../../functions/compute-frames";

// Enable Immer MapSet plugin for tests
enableMapSet();

describe("Multi-Drag Selection Persistence", () => {
  let mockState: AnimationData;
  let mockGet: () => AnimationData & AnimationActions;
  let mockSet: (
    partial:
      | (AnimationData & AnimationActions)
      | Partial<AnimationData & AnimationActions>
      | ((
          state: AnimationData & AnimationActions,
        ) => (AnimationData & AnimationActions) | Partial<AnimationData & AnimationActions>),
    replace?: false | undefined,
  ) => void;

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
            { id: "point1", stamp: 0.1, value: 10 }, // Will be selected
            { id: "point2", stamp: 0.2, value: 20 }, // NOT selected
            { id: "point3", stamp: 0.3, value: 30 }, // Will be selected
            { id: "point4", stamp: 0.4, value: 40 }, // NOT selected
          ],
        } as Track<RawValue>,
        track2: {
          id: "track2",
          name: "Track 2",
          animatableId: "anim2",
          points: [
            { id: "point5", stamp: 0.1, value: 50 }, // Will be selected (same stamp as point1)
            { id: "point6", stamp: 0.25, value: 60 }, // NOT selected
            { id: "point7", stamp: 0.3, value: 70 }, // Will be selected (same stamp as point3)
            { id: "point8", stamp: 0.35, value: 80 }, // NOT selected
          ],
        } as Track<RawValue>,
        track3: {
          id: "track3",
          name: "Track 3",
          animatableId: "anim3",
          points: [
            { id: "point9", stamp: 0.15, value: 90 }, // Will be selected
            { id: "point10", stamp: 0.2, value: 100 }, // NOT selected (merge target)
            { id: "point11", stamp: 0.45, value: 110 }, // NOT selected
          ],
        } as Track<RawValue>,
      },
    };

    mockGet = () => mockState as AnimationData & AnimationActions;
    mockSet = (partial, _replace) => {
      if (typeof partial === "function") {
        const result = partial(mockState as AnimationData & AnimationActions);
        if (result && typeof result === "object") {
          mockState = produce(mockState, (draft) => {
            Object.assign(draft, result);
          });
        }
      } else {
        mockState = produce(mockState, (draft) => {
          Object.assign(draft, partial);
        });
      }
    };
  });

  describe("Basic Multi-Selection Persistence", () => {
    it("should maintain all selected markers after drag without merging", () => {
      const initialFrames = computeFrames(mockState.tracks);

      // Select frames at 0.1 (point1 + point5), 0.3 (point3 + point7), and 0.15 (point9)
      const frame01 = initialFrames.find((f) => Math.abs(f.stamp - 0.1) < 0.001);
      const frame03 = initialFrames.find((f) => Math.abs(f.stamp - 0.3) < 0.001);
      const frame015 = initialFrames.find((f) => Math.abs(f.stamp - 0.15) < 0.001);

      expect(frame01).toBeDefined();
      expect(frame03).toBeDefined();
      expect(frame015).toBeDefined();

      mockState.selection = [frame01!, frame03!, frame015!];
      expect(mockState.selection.length).toBe(3);

      // Drag all selected markers by 0.05 (won't cause merging)
      startDragging(mockGet, mockSet);
      updateDragDelta(mockGet, mockSet, 0.05, false);
      commitDrag(mockGet, mockSet);

      // All three frames should still be selected at their new positions
      expect(mockState.selection.length).toBe(3);

      // Verify the new positions
      expect(mockState.selection.some((f) => Math.abs(f.stamp - 0.15) < 0.001)).toBe(true); // 0.1 + 0.05
      expect(mockState.selection.some((f) => Math.abs(f.stamp - 0.35) < 0.001)).toBe(true); // 0.3 + 0.05
      expect(mockState.selection.some((f) => Math.abs(f.stamp - 0.2) < 0.001)).toBe(true); // 0.15 + 0.05
    });

    it("should maintain selection when some markers merge with unselected ones", () => {
      const initialFrames = computeFrames(mockState.tracks);

      // Select frames at 0.1 (point1 + point5) and 0.15 (point9)
      const frame01 = initialFrames.find((f) => Math.abs(f.stamp - 0.1) < 0.001);
      const frame015 = initialFrames.find((f) => Math.abs(f.stamp - 0.15) < 0.001);

      mockState.selection = [frame01!, frame015!];
      expect(mockState.selection.length).toBe(2);

      // Drag by 0.1: frame at 0.1 moves to 0.2 (merges with point2 and point10)
      // frame at 0.15 moves to 0.25 (merges with point6)
      startDragging(mockGet, mockSet);
      updateDragDelta(mockGet, mockSet, 0.1, false);
      commitDrag(mockGet, mockSet);

      // Both frames should still be selected even though they merged with unselected markers
      expect(mockState.selection.length).toBe(2);

      const finalFrames = computeFrames(mockState.tracks);

      // Check frame at 0.2 contains point1, point5 (selected) and point2, point10 (unselected)
      const frame02 = finalFrames.find((f) => Math.abs(f.stamp - 0.2) < 0.001);
      expect(frame02).toBeDefined();
      expect(frame02?.points.some((p) => p.id === "point1")).toBe(true);
      expect(frame02?.points.some((p) => p.id === "point5")).toBe(true);
      expect(frame02?.points.some((p) => p.id === "point2")).toBe(true);
      expect(frame02?.points.some((p) => p.id === "point10")).toBe(true);

      // Check frame at 0.25 contains point9 (selected) and point6 (unselected)
      const frame025 = finalFrames.find((f) => Math.abs(f.stamp - 0.25) < 0.001);
      expect(frame025).toBeDefined();
      expect(frame025?.points.some((p) => p.id === "point9")).toBe(true);
      expect(frame025?.points.some((p) => p.id === "point6")).toBe(true);

      // Both should be in selection
      expect(mockState.selection.some((f) => Math.abs(f.stamp - 0.2) < 0.001)).toBe(true);
      expect(mockState.selection.some((f) => Math.abs(f.stamp - 0.25) < 0.001)).toBe(true);
    });
  });

  describe("Complex Multi-Selection Scenarios", () => {
    it("should handle partial selection of multi-track frames", () => {
      const initialFrames = computeFrames(mockState.tracks);

      // Select only the frame at 0.1 (contains point1 and point5)
      const frame01 = initialFrames.find((f) => Math.abs(f.stamp - 0.1) < 0.001);
      expect(frame01?.points.length).toBe(2);

      // Also select frame at 0.3 (contains point3 and point7)
      const frame03 = initialFrames.find((f) => Math.abs(f.stamp - 0.3) < 0.001);
      expect(frame03?.points.length).toBe(2);

      mockState.selection = [frame01!, frame03!];

      // Drag by -0.05 (moving backward)
      startDragging(mockGet, mockSet);
      updateDragDelta(mockGet, mockSet, -0.05, false);
      commitDrag(mockGet, mockSet);

      // Both frames should remain selected at new positions
      expect(mockState.selection.length).toBe(2);
      expect(mockState.selection.some((f) => Math.abs(f.stamp - 0.05) < 0.001)).toBe(true);
      expect(mockState.selection.some((f) => Math.abs(f.stamp - 0.25) < 0.001)).toBe(true);
    });

    it("should maintain selection when all selected markers converge to same stamp", () => {
      const initialFrames = computeFrames(mockState.tracks);

      // Select frames at different stamps
      const frame01 = initialFrames.find((f) => Math.abs(f.stamp - 0.1) < 0.001);
      const frame015 = initialFrames.find((f) => Math.abs(f.stamp - 0.15) < 0.001);

      mockState.selection = [frame01!, frame015!];

      // Move point9 from 0.15 to 0.1 first (manual adjustment for convergence test)
      mockState.tracks.track3.points[0].stamp = 0.1;

      // Now select the merged frame
      const mergedFrames = computeFrames(mockState.tracks);
      const mergedFrame = mergedFrames.find((f) => Math.abs(f.stamp - 0.1) < 0.001);
      expect(mergedFrame?.points.length).toBe(3); // point1, point5, point9

      mockState.selection = [mergedFrame!];

      // Drag the merged frame
      startDragging(mockGet, mockSet);
      updateDragDelta(mockGet, mockSet, 0.15, false);
      commitDrag(mockGet, mockSet);

      // The merged frame should remain selected at new position
      expect(mockState.selection.length).toBe(1);
      expect(mockState.selection[0].stamp).toBeCloseTo(0.25, 3);
      // The frame at 0.25 also merges with point6 which was already there
      expect(mockState.selection[0].points.length).toBe(4); // point1, point5, point9, point6
    });

    it("should handle selection when dragging to boundary conditions", () => {
      const initialFrames = computeFrames(mockState.tracks);

      // Select multiple frames
      const frame01 = initialFrames.find((f) => Math.abs(f.stamp - 0.1) < 0.001);
      const frame03 = initialFrames.find((f) => Math.abs(f.stamp - 0.3) < 0.001);

      mockState.selection = [frame01!, frame03!];

      // Drag to near the end boundary
      startDragging(mockGet, mockSet);
      updateDragDelta(mockGet, mockSet, 0.65, false); // 0.3 + 0.65 = 0.95 (near 1.0)
      commitDrag(mockGet, mockSet);

      // Both frames should still be selected
      expect(mockState.selection.length).toBe(2);

      // Check positions are clamped properly
      const finalFrames = computeFrames(mockState.tracks);
      const frame075 = finalFrames.find((f) => Math.abs(f.stamp - 0.75) < 0.001);
      const frame095 = finalFrames.find((f) => Math.abs(f.stamp - 0.95) < 0.001);

      expect(frame075).toBeDefined();
      expect(frame095).toBeDefined();
    });
  });

  describe("Reference Marker Persistence", () => {
    it("should maintain reference marker during multi-selection drag", () => {
      const initialFrames = computeFrames(mockState.tracks);

      // Select multiple frames and set one as reference
      const frame01 = initialFrames.find((f) => Math.abs(f.stamp - 0.1) < 0.001);
      const frame03 = initialFrames.find((f) => Math.abs(f.stamp - 0.3) < 0.001);

      mockState.selection = [frame01!, frame03!];
      mockState.referenceMarker = {
        marker: frame01!,
        sources: [
          { trackId: "track1", type: "number" },
          { trackId: "track2", type: "number" },
        ],
      };

      // Drag the selection
      startDragging(mockGet, mockSet);
      updateDragDelta(mockGet, mockSet, 0.1, false);
      commitDrag(mockGet, mockSet);

      // Reference marker should be updated to new position
      expect(mockState.referenceMarker).toBeDefined();
      expect(mockState.referenceMarker?.marker.stamp).toBeCloseTo(0.2, 3);

      // Selection should be maintained
      expect(mockState.selection.length).toBe(2);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty initial selection", () => {
      mockState.selection = [];

      startDragging(mockGet, mockSet);
      expect(mockState.dragState).toBeNull();
    });

    it("should maintain selection with very small drag deltas", () => {
      const initialFrames = computeFrames(mockState.tracks);
      const frame01 = initialFrames.find((f) => Math.abs(f.stamp - 0.1) < 0.001);

      mockState.selection = [frame01!];

      // Very small drag delta
      startDragging(mockGet, mockSet);
      updateDragDelta(mockGet, mockSet, 0.0001, false);
      commitDrag(mockGet, mockSet);

      // Selection should be maintained
      expect(mockState.selection.length).toBe(1);
      expect(mockState.selection[0].stamp).toBeCloseTo(0.1001, 4);
    });

    it("should handle selection when all markers in a frame are dragged", () => {
      const initialFrames = computeFrames(mockState.tracks);

      // Select a multi-point frame (0.1 has point1 and point5)
      const frame01 = initialFrames.find((f) => Math.abs(f.stamp - 0.1) < 0.001);
      expect(frame01?.points.length).toBe(2);

      mockState.selection = [frame01!];

      // Drag to a position where it merges with other markers
      startDragging(mockGet, mockSet);
      updateDragDelta(mockGet, mockSet, 0.1, false); // Move to 0.2
      commitDrag(mockGet, mockSet);

      // The frame should remain selected even after merging
      expect(mockState.selection.length).toBe(1);

      const finalFrames = computeFrames(mockState.tracks);
      const mergedFrame = finalFrames.find((f) => Math.abs(f.stamp - 0.2) < 0.001);

      // Should contain original points plus merged points
      expect(mergedFrame?.points.some((p) => p.id === "point1")).toBe(true);
      expect(mergedFrame?.points.some((p) => p.id === "point5")).toBe(true);
      expect(mergedFrame?.points.some((p) => p.id === "point2")).toBe(true); // Merged
      expect(mergedFrame?.points.some((p) => p.id === "point10")).toBe(true); // Merged
    });
  });
});
