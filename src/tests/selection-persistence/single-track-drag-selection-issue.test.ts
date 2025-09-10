import { describe, it, expect, beforeEach } from "vitest";
import { enableMapSet, produce } from "immer";
import type { RawValue } from "@semio/utils";
import type { Track } from "../../types";
import type { AnimationData } from "../../store-types";
import { createDefaultState } from "../../actions/create-default-state";
import { startDragging, updateDragDelta, commitDrag } from "../../actions/drag";
import { computeFrames } from "../../functions/compute-frames";
import { computeMarkerSelection } from "../../functions/compute-marker-selection";
import { compareInstancedFrames, FrameComparison } from "../../functions/compare-instanced-frames";

// Enable Immer MapSet plugin for tests
enableMapSet();

describe("Single Track Drag Selection Issue", () => {
  let mockState: AnimationData;

  beforeEach(() => {
    // Initialize with a single track containing multiple markers
    // This closely mimics the reported issue scenario
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
            { id: "point2", stamp: 0.2, value: 20 },
            { id: "point3", stamp: 0.3, value: 30 },
            { id: "point4", stamp: 0.4, value: 40 },
            { id: "point5", stamp: 0.5, value: 50 },
            { id: "point6", stamp: 0.6, value: 60 },
            { id: "point7", stamp: 0.7, value: 70 },
            { id: "point8", stamp: 0.8, value: 80 },
          ],
        } as Track<RawValue>,
      },
    };
  });

  describe("Exact reproduction of reported issue", () => {
    it("should allow individual marker selection after multi-select drag in single track", () => {
      const initialFrames = computeFrames(mockState.tracks);
      const sources = [{ trackId: "track1", type: "number" as const }];

      // Step 1: Multi-select three markers in a single track
      // Using shift-click to select a range (common user interaction)
      const frame02 = initialFrames.find((f) => Math.abs(f.stamp - 0.2) < 0.001);
      const frame03 = initialFrames.find((f) => Math.abs(f.stamp - 0.3) < 0.001);
      const frame04 = initialFrames.find((f) => Math.abs(f.stamp - 0.4) < 0.001);

      expect(frame02).toBeDefined();
      expect(frame03).toBeDefined();
      expect(frame04).toBeDefined();

      // Simulate selecting first marker
      let result = computeMarkerSelection(frame02!, sources, initialFrames, [], null, false, false);

      mockState = produce(mockState, (draft) => {
        draft.selection = result.selection;
        draft.referenceMarker = result.reference;
      });

      // Simulate shift-clicking to select range to third marker
      result = computeMarkerSelection(
        frame04!,
        sources,
        initialFrames,
        mockState.selection,
        mockState.referenceMarker,
        true, // shift
        false,
      );

      mockState = produce(mockState, (draft) => {
        draft.selection = result.selection;
        draft.referenceMarker = result.reference;
      });

      // Verify three markers are selected
      expect(mockState.selection.length).toBe(3);
      const selectedPointIds = new Set(
        mockState.selection.flatMap((f) => f.points.map((p) => p.id)),
      );
      expect(selectedPointIds.has("point2")).toBe(true);
      expect(selectedPointIds.has("point3")).toBe(true);
      expect(selectedPointIds.has("point4")).toBe(true);

      // Step 2: Move them (drag operation)
      mockState = produce(mockState, (draft) => {
        startDragging(draft);
        updateDragDelta(draft, 0.25, false); // Move to 0.45, 0.55, 0.65
        commitDrag(draft);
      });

      // Verify markers moved to new positions
      expect(mockState.selection.length).toBe(3);
      expect(mockState.selection.some((f) => Math.abs(f.stamp - 0.45) < 0.001)).toBe(true);
      expect(mockState.selection.some((f) => Math.abs(f.stamp - 0.55) < 0.001)).toBe(true);
      expect(mockState.selection.some((f) => Math.abs(f.stamp - 0.65) < 0.001)).toBe(true);

      // Step 3: Deselect by clicking in empty space
      mockState = produce(mockState, (draft) => {
        draft.selection = [];
        draft.referenceMarker = null;
      });

      // Step 4: Try to select one of the moved markers individually
      const newFrames = computeFrames(mockState.tracks);

      // Log frame information for debugging
      console.log("\n=== Frames after drag ===");
      newFrames.forEach((f) => {
        console.log(
          `  Frame at ${f.stamp.toString()}: id="${f.id}", points=[${f.points.map((p) => p.id).join(", ")}]`,
        );
      });

      // Also log track state
      console.log("\n=== Track points after drag ===");
      Object.values(mockState.tracks).forEach((track) => {
        (track as Track<RawValue>).points.forEach((p) => {
          console.log(`  ${p.id}: stamp=${p.stamp.toString()}, value=${JSON.stringify(p.value)}`);
        });
      });

      // Try to select the middle moved marker (originally point3, now at 0.55)
      const movedFrame055 = newFrames.find((f) => Math.abs(f.stamp - 0.55) < 0.001);
      expect(movedFrame055).toBeDefined();
      expect(movedFrame055!.points.length).toBe(1);
      expect(movedFrame055!.points[0].id).toBe("point3");
      expect(movedFrame055!.id).toBe("point3"); // Frame ID should match point ID for single-point frame

      // This should allow selection of the individual marker
      result = computeMarkerSelection(
        movedFrame055!,
        sources,
        newFrames,
        [],
        null,
        false, // no shift
        false, // no mod
      );

      // CRITICAL: This individual selection should work
      expect(result.selection.length).toBe(1);
      expect(result.selection[0].id).toBe("point3");
      expect(result.selection[0].stamp).toBeCloseTo(0.55, 3);
      expect(result.reference?.marker.id).toBe("point3");
    });

    it("should verify frame comparison works correctly after drag", () => {
      const initialFrames = computeFrames(mockState.tracks);

      // Select and move some markers
      const frame02 = initialFrames.find((f) => Math.abs(f.stamp - 0.2) < 0.001);
      const frame03 = initialFrames.find((f) => Math.abs(f.stamp - 0.3) < 0.001);

      mockState.selection = [frame02!, frame03!];

      mockState = produce(mockState, (draft) => {
        startDragging(draft);
        updateDragDelta(draft, 0.15, false);
        commitDrag(draft);
      });

      const newFrames = computeFrames(mockState.tracks);

      // Find the moved frames
      const movedFrame035 = newFrames.find((f) => Math.abs(f.stamp - 0.35) < 0.001);
      const movedFrame045 = newFrames.find((f) => Math.abs(f.stamp - 0.45) < 0.001);

      expect(movedFrame035).toBeDefined();
      expect(movedFrame045).toBeDefined();

      // Test frame comparison
      const comparison1 = compareInstancedFrames(movedFrame035!, movedFrame035!);
      expect(comparison1).toBe(FrameComparison.Equal);

      const comparison2 = compareInstancedFrames(movedFrame035!, movedFrame045!);
      expect(comparison2).toBe(FrameComparison.Disjoint);

      // Verify selection comparison works
      mockState.selection.forEach((selectedFrame) => {
        const matchingFrame = newFrames.find(
          (f) => compareInstancedFrames(f, selectedFrame) === FrameComparison.Equal,
        );
        expect(matchingFrame).toBeDefined();
      });
    });

    it("should handle the case where dragged markers land near existing markers", () => {
      // Add more complexity: existing markers at destination positions
      mockState = {
        ...mockState,
        tracks: {
          track1: {
            id: "track1",
            name: "Track 1",
            animatableId: "anim1",
            points: [
              { id: "point1", stamp: 0.1, value: 10 },
              { id: "point2", stamp: 0.2, value: 20 },
              { id: "point3", stamp: 0.3, value: 30 },
              { id: "point4", stamp: 0.4, value: 40 },
              // Existing markers near where we'll drag to
              { id: "point5", stamp: 0.449, value: 45 }, // Very close to 0.45
              { id: "point6", stamp: 0.451, value: 46 }, // Very close to 0.45
              { id: "point7", stamp: 0.55, value: 55 }, // Exactly at 0.55
              { id: "point8", stamp: 0.65, value: 65 }, // Exactly at 0.65
            ],
          } as Track<RawValue>,
        },
      };

      const initialFrames = computeFrames(mockState.tracks);
      const sources = [{ trackId: "track1", type: "number" as const }];

      // Select first three markers
      const frame01 = initialFrames.find((f) => Math.abs(f.stamp - 0.1) < 0.001);
      const frame02 = initialFrames.find((f) => Math.abs(f.stamp - 0.2) < 0.001);
      const frame03 = initialFrames.find((f) => Math.abs(f.stamp - 0.3) < 0.001);

      mockState.selection = [frame01!, frame02!, frame03!];

      // Drag them to positions near existing markers
      mockState = produce(mockState, (draft) => {
        startDragging(draft);
        updateDragDelta(draft, 0.35, false); // Move to 0.45, 0.55, 0.65
        commitDrag(draft);
      });

      // Clear selection
      mockState = produce(mockState, (draft) => {
        draft.selection = [];
        draft.referenceMarker = null;
      });

      const newFrames = computeFrames(mockState.tracks);

      // Check frame structure after drag
      const frame045 = newFrames.find((f) => Math.abs(f.stamp - 0.45) < 0.001);
      const frame055 = newFrames.find((f) => Math.abs(f.stamp - 0.55) < 0.001);
      const frame065 = newFrames.find((f) => Math.abs(f.stamp - 0.65) < 0.001);

      expect(frame045).toBeDefined();
      expect(frame055).toBeDefined();
      expect(frame065).toBeDefined();

      // Log actual frame structure for debugging
      console.log("Frame at 0.45:", frame045);
      console.log("Frame at 0.55:", frame055);
      console.log("Frame at 0.65:", frame065);

      // Check what actually happened with the tracks
      console.log("Track points after drag:");
      Object.values(mockState.tracks).forEach((track) => {
        (track as Track<RawValue>).points.forEach((p) => {
          console.log(`  ${p.id}: stamp=${p.stamp.toString()}`);
        });
      });

      // Frame at 0.55 - check if merge happened
      if (frame055!.points.length === 2) {
        expect(frame055!.points.some((p) => p.id === "point2")).toBe(true);
        expect(frame055!.points.some((p) => p.id === "point7")).toBe(true);
        expect(frame055!.id).toBe("point2-point7"); // Merged frame ID
      } else {
        console.log("Frame at 0.55 did not merge as expected. Points:", frame055!.points);
        // It's possible the points ended up at slightly different timestamps
        expect(frame055!.points.length).toBe(1);
      }

      // Frame at 0.65 - check if merge happened
      if (frame065!.points.length === 2) {
        expect(frame065!.points.some((p) => p.id === "point3")).toBe(true);
        expect(frame065!.points.some((p) => p.id === "point8")).toBe(true);
        expect(frame065!.id).toBe("point3-point8"); // Merged frame ID
      } else {
        console.log("Frame at 0.65 did not merge as expected. Points:", frame065!.points);
        // It's possible the points ended up at slightly different timestamps
        expect(frame065!.points.length).toBe(1);
      }

      // Try to select the merged frame at 0.55
      const result = computeMarkerSelection(frame055!, sources, newFrames, [], null, false, false);

      // Should be able to select the merged frame
      expect(result.selection.length).toBe(1);
      expect(result.selection[0].id).toBe("point2-point7");
      expect(result.selection[0].points.length).toBe(2);
    });

    it("should test shift-click range selection after individual selection fails", () => {
      const initialFrames = computeFrames(mockState.tracks);
      const sources = [{ trackId: "track1", type: "number" as const }];

      // Select and move three markers
      const frame02 = initialFrames.find((f) => Math.abs(f.stamp - 0.2) < 0.001);
      const frame03 = initialFrames.find((f) => Math.abs(f.stamp - 0.3) < 0.001);
      const frame04 = initialFrames.find((f) => Math.abs(f.stamp - 0.4) < 0.001);

      mockState.selection = [frame02!, frame03!, frame04!];

      mockState = produce(mockState, (draft) => {
        startDragging(draft);
        updateDragDelta(draft, 0.25, false);
        commitDrag(draft);
      });

      // Clear selection
      mockState = produce(mockState, (draft) => {
        draft.selection = [];
        draft.referenceMarker = null;
      });

      const newFrames = computeFrames(mockState.tracks);

      // According to the issue, individual selection might fail
      // but range selection should work

      // First, select a different marker (not one that was moved)
      const frame01 = newFrames.find((f) => Math.abs(f.stamp - 0.1) < 0.001);
      expect(frame01).toBeDefined();

      let result = computeMarkerSelection(frame01!, sources, newFrames, [], null, false, false);

      mockState = produce(mockState, (draft) => {
        draft.selection = result.selection;
        draft.referenceMarker = result.reference;
      });

      // Now shift-click to one of the moved markers to create a range
      const movedFrame055 = newFrames.find((f) => Math.abs(f.stamp - 0.55) < 0.001);
      expect(movedFrame055).toBeDefined();

      result = computeMarkerSelection(
        movedFrame055!,
        sources,
        newFrames,
        mockState.selection,
        mockState.referenceMarker,
        true, // shift for range selection
        false,
      );

      // Range selection should work and include the moved marker
      expect(result.selection.length).toBeGreaterThan(1);
      expect(result.selection.some((f) => Math.abs(f.stamp - 0.1) < 0.001)).toBe(true);
      expect(result.selection.some((f) => Math.abs(f.stamp - 0.55) < 0.001)).toBe(true);

      // The problematic marker should be included in the range
      const problematicMarker = result.selection.find((f) => Math.abs(f.stamp - 0.55) < 0.001);
      expect(problematicMarker).toBeDefined();
      expect(problematicMarker!.points.some((p) => p.id === "point3")).toBe(true);
    });

    it("should verify reference marker behavior after drag", () => {
      const initialFrames = computeFrames(mockState.tracks);
      const sources = [{ trackId: "track1", type: "number" as const }];

      // Select markers with a reference
      const frame02 = initialFrames.find((f) => Math.abs(f.stamp - 0.2) < 0.001);
      const frame03 = initialFrames.find((f) => Math.abs(f.stamp - 0.3) < 0.001);
      const frame04 = initialFrames.find((f) => Math.abs(f.stamp - 0.4) < 0.001);

      mockState.selection = [frame02!, frame03!, frame04!];
      mockState.referenceMarker = {
        marker: frame02!,
        sources,
        isAddMode: false,
      };

      // Store reference marker ID
      const referenceId = mockState.referenceMarker.marker.id;
      expect(referenceId).toBe("point2");

      // Drag the selection
      mockState = produce(mockState, (draft) => {
        startDragging(draft);
        updateDragDelta(draft, 0.25, false);
        commitDrag(draft);
      });

      // Reference marker should be updated to new position
      expect(mockState.referenceMarker).toBeDefined();
      expect(mockState.referenceMarker!.marker.stamp).toBeCloseTo(0.45, 3);
      expect(mockState.referenceMarker!.marker.points[0].id).toBe("point2");

      // Clear selection
      mockState = produce(mockState, (draft) => {
        draft.selection = [];
        draft.referenceMarker = null;
      });

      const newFrames = computeFrames(mockState.tracks);

      // Try to select the former reference marker at its new position
      const movedReferenceFrame = newFrames.find((f) => f.points.some((p) => p.id === "point2"));
      expect(movedReferenceFrame).toBeDefined();
      expect(movedReferenceFrame!.stamp).toBeCloseTo(0.45, 3);

      const result = computeMarkerSelection(
        movedReferenceFrame!,
        sources,
        newFrames,
        [],
        null,
        false,
        false,
      );

      // Should be able to select the former reference marker
      expect(result.selection.length).toBe(1);
      expect(result.selection[0].points[0].id).toBe("point2");
      expect(result.reference?.marker.points[0].id).toBe("point2");
    });
  });
});
