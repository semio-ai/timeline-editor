import { describe, it, expect, beforeEach } from "vitest";
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

describe("Shift-Click Selection After Drag Issue", () => {
  let mockState: AnimationData;

  beforeEach(() => {
    // Initialize mock state with a single track containing multiple markers
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
          ],
        } as Track<RawValue>,
      },
    };
  });

  describe("Reproducing the reported issue", () => {
    it("should allow individual marker selection after multi-select drag and deselect", () => {
      const initialFrames = computeFrames(mockState.tracks);
      const sources = [{ trackId: "track1", type: "number" as const }];

      // Step 1: Multi-select three markers in a single track
      const frame02 = initialFrames.find((f) => Math.abs(f.stamp - 0.2) < 0.001);
      const frame03 = initialFrames.find((f) => Math.abs(f.stamp - 0.3) < 0.001);
      const frame04 = initialFrames.find((f) => Math.abs(f.stamp - 0.4) < 0.001);

      expect(frame02).toBeDefined();
      expect(frame03).toBeDefined();
      expect(frame04).toBeDefined();

      // Simulate clicking first marker
      let result = computeMarkerSelection(frame02!, sources, initialFrames, [], null, false, false);
      mockState.selection = result.selection;
      mockState.referenceMarker = result.reference;

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
      mockState.selection = result.selection;
      mockState.referenceMarker = result.reference;

      expect(mockState.selection.length).toBe(3);
      // Verify the selected frames have the expected point IDs
      const selectedPointIds = new Set(
        mockState.selection.flatMap((f) => f.points.map((p) => p.id)),
      );
      expect(selectedPointIds.has("point2")).toBe(true);
      expect(selectedPointIds.has("point3")).toBe(true);
      expect(selectedPointIds.has("point4")).toBe(true);

      // Step 2: Move them (drag operation)
      mockState = produce(mockState, (draft) => {
        startDragging(draft);
        updateDragDelta(draft, 0.15, false);
        commitDrag(draft);
      });

      // Verify markers moved to new positions
      expect(mockState.selection.length).toBe(3);
      expect(mockState.selection.some((f) => Math.abs(f.stamp - 0.35) < 0.001)).toBe(true);
      expect(mockState.selection.some((f) => Math.abs(f.stamp - 0.45) < 0.001)).toBe(true);
      expect(mockState.selection.some((f) => Math.abs(f.stamp - 0.55) < 0.001)).toBe(true);

      // Step 3: Deselect by clicking in empty space (simulated by clearing selection)
      mockState = produce(mockState, (draft) => {
        draft.selection = [];
        draft.referenceMarker = null;
      });

      // Step 4: Try to select one of the moved markers individually
      const newFrames = computeFrames(mockState.tracks);
      const movedFrame045 = newFrames.find((f) => Math.abs(f.stamp - 0.45) < 0.001);
      expect(movedFrame045).toBeDefined();

      // This should allow selection of the individual marker
      result = computeMarkerSelection(
        movedFrame045!,
        sources,
        newFrames,
        mockState.selection,
        mockState.referenceMarker,
        false, // no shift
        false, // no mod
      );

      expect(result.selection.length).toBe(1);
      expect(result.selection[0]).toEqual(movedFrame045);
      expect(result.reference?.marker).toEqual(movedFrame045);
    });

    it("should allow shift-click range selection after drag and deselect", () => {
      const initialFrames = computeFrames(mockState.tracks);
      const sources = [{ trackId: "track1", type: "number" as const }];

      // Multi-select markers
      const frame01 = initialFrames.find((f) => Math.abs(f.stamp - 0.1) < 0.001);
      const frame02 = initialFrames.find((f) => Math.abs(f.stamp - 0.2) < 0.001);
      const frame03 = initialFrames.find((f) => Math.abs(f.stamp - 0.3) < 0.001);

      mockState.selection = [frame01!, frame02!, frame03!];
      mockState.referenceMarker = {
        marker: frame01!,
        sources,
        isAddMode: false,
      };

      // Drag them
      mockState = produce(mockState, (draft) => {
        startDragging(draft);
        updateDragDelta(draft, 0.2, false);
        commitDrag(draft);
      });

      // Clear selection
      mockState = produce(mockState, (draft) => {
        draft.selection = [];
        draft.referenceMarker = null;
      });

      // Now try to select a range using shift-click
      const newFrames = computeFrames(mockState.tracks);

      // First click on one of the moved markers
      const movedFrame03 = newFrames.find((f) => Math.abs(f.stamp - 0.3) < 0.001);
      expect(movedFrame03).toBeDefined();

      let result = computeMarkerSelection(
        movedFrame03!,
        sources,
        newFrames,
        [],
        null,
        false,
        false,
      );
      mockState = produce(mockState, (draft) => {
        draft.selection = result.selection;
        draft.referenceMarker = result.reference;
      });

      // Then shift-click on another moved marker to create range
      const movedFrame05 = newFrames.find((f) => Math.abs(f.stamp - 0.5) < 0.001);
      expect(movedFrame05).toBeDefined();

      result = computeMarkerSelection(
        movedFrame05!,
        sources,
        newFrames,
        mockState.selection,
        mockState.referenceMarker,
        true, // shift
        false,
      );

      mockState = produce(mockState, (draft) => {
        draft.selection = result.selection;
        draft.referenceMarker = result.reference;
      });

      // Should have selected the range between the two markers
      expect(mockState.selection.length).toBe(3);
      expect(mockState.selection.some((f) => Math.abs(f.stamp - 0.3) < 0.001)).toBe(true);
      expect(mockState.selection.some((f) => Math.abs(f.stamp - 0.4) < 0.001)).toBe(true);
      expect(mockState.selection.some((f) => Math.abs(f.stamp - 0.5) < 0.001)).toBe(true);
    });

    it("should handle mixed selection scenarios after drag", () => {
      const initialFrames = computeFrames(mockState.tracks);
      const sources = [{ trackId: "track1", type: "number" as const }];

      // Select and drag some markers
      const frame02 = initialFrames.find((f) => Math.abs(f.stamp - 0.2) < 0.001);
      const frame03 = initialFrames.find((f) => Math.abs(f.stamp - 0.3) < 0.001);
      const frame04 = initialFrames.find((f) => Math.abs(f.stamp - 0.4) < 0.001);

      mockState.selection = [frame02!, frame03!, frame04!];
      mockState.referenceMarker = {
        marker: frame02!,
        sources,
        isAddMode: false,
      };

      // Drag them
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

      // Select one of the unmoved markers
      const unmovedFrame01 = newFrames.find((f) => Math.abs(f.stamp - 0.1) < 0.001);
      expect(unmovedFrame01).toBeDefined();

      let result = computeMarkerSelection(
        unmovedFrame01!,
        sources,
        newFrames,
        [],
        null,
        false,
        false,
      );
      mockState = produce(mockState, (draft) => {
        draft.selection = result.selection;
        draft.referenceMarker = result.reference;
      });

      // Shift-click to a moved marker - should create range
      const movedFrame045 = newFrames.find((f) => Math.abs(f.stamp - 0.45) < 0.001);
      expect(movedFrame045).toBeDefined();

      result = computeMarkerSelection(
        movedFrame045!,
        sources,
        newFrames,
        mockState.selection,
        mockState.referenceMarker,
        true, // shift
        false,
      );

      mockState = produce(mockState, (draft) => {
        draft.selection = result.selection;
        draft.referenceMarker = result.reference;
      });

      // Should select range from 0.1 to 0.45
      expect(mockState.selection.length).toBeGreaterThan(1);
      expect(mockState.selection.some((f) => Math.abs(f.stamp - 0.1) < 0.001)).toBe(true);
      expect(mockState.selection.some((f) => Math.abs(f.stamp - 0.45) < 0.001)).toBe(true);
    });

    it("should allow ctrl/cmd-click multi-selection after drag", () => {
      const initialFrames = computeFrames(mockState.tracks);
      const sources = [{ trackId: "track1", type: "number" as const }];

      // Select and drag markers
      const frame01 = initialFrames.find((f) => Math.abs(f.stamp - 0.1) < 0.001);
      const frame02 = initialFrames.find((f) => Math.abs(f.stamp - 0.2) < 0.001);

      mockState.selection = [frame01!, frame02!];

      // Drag them
      mockState = produce(mockState, (draft) => {
        startDragging(draft);
        updateDragDelta(draft, 0.3, false);
        commitDrag(draft);
      });

      // Clear selection
      mockState = produce(mockState, (draft) => {
        draft.selection = [];
        draft.referenceMarker = null;
      });

      const newFrames = computeFrames(mockState.tracks);

      // Try to multi-select using ctrl/cmd
      const movedFrame04 = newFrames.find((f) => Math.abs(f.stamp - 0.4) < 0.001);
      const movedFrame05 = newFrames.find((f) => Math.abs(f.stamp - 0.5) < 0.001);
      const unmovedFrame03 = newFrames.find((f) => Math.abs(f.stamp - 0.3) < 0.001);

      // First selection
      let result = computeMarkerSelection(
        movedFrame04!,
        sources,
        newFrames,
        [],
        null,
        false,
        false,
      );
      mockState = produce(mockState, (draft) => {
        draft.selection = result.selection;
        draft.referenceMarker = result.reference;
      });

      // Ctrl-click to add another moved marker
      result = computeMarkerSelection(
        movedFrame05!,
        sources,
        newFrames,
        mockState.selection,
        mockState.referenceMarker,
        false,
        true, // mod key
      );
      mockState = produce(mockState, (draft) => {
        draft.selection = result.selection;
        draft.referenceMarker = result.reference;
      });

      expect(mockState.selection.length).toBe(2);

      // Ctrl-click to add an unmoved marker
      result = computeMarkerSelection(
        unmovedFrame03!,
        sources,
        newFrames,
        mockState.selection,
        mockState.referenceMarker,
        false,
        true, // mod key
      );

      expect(result.selection.length).toBe(3);
      expect(result.selection.some((f) => Math.abs(f.stamp - 0.3) < 0.001)).toBe(true);
      expect(result.selection.some((f) => Math.abs(f.stamp - 0.4) < 0.001)).toBe(true);
      expect(result.selection.some((f) => Math.abs(f.stamp - 0.5) < 0.001)).toBe(true);
    });

    it("should maintain correct frame IDs after drag operations", () => {
      const initialFrames = computeFrames(mockState.tracks);

      // Check initial frame IDs
      initialFrames.forEach((frame) => {
        expect(frame.id).toBeDefined();
        expect(frame.points.length).toBeGreaterThan(0);
        // Frame ID should match the point ID for single-point frames
        if (frame.points.length === 1) {
          expect(frame.id).toBe(frame.points[0].id);
        }
      });

      // Select and drag some markers
      const framesToDrag = initialFrames.slice(1, 4);
      mockState.selection = framesToDrag;

      mockState = produce(mockState, (draft) => {
        startDragging(draft);
        updateDragDelta(draft, 0.15, false);
        commitDrag(draft);
      });

      // Get frames after drag
      const newFrames = computeFrames(mockState.tracks);

      // Verify all frames have valid IDs
      newFrames.forEach((frame) => {
        expect(frame.id).toBeDefined();
        expect(frame.id).not.toBe("");

        // For single-point frames, ID should match point ID
        if (frame.points.length === 1) {
          expect(frame.id).toBe(frame.points[0].id);
        } else {
          // For multi-point frames, ID should be concatenated point IDs
          const expectedId = frame.points
            .map((p) => p.id)
            .sort()
            .join("-");
          expect(frame.id).toBe(expectedId);
        }
      });

      // Verify that we can still select frames by their new positions
      const sources = [{ trackId: "track1", type: "number" as const }];

      newFrames.forEach((frame) => {
        const result = computeMarkerSelection(frame, sources, newFrames, [], null, false, false);

        expect(result.selection.length).toBe(1);
        expect(result.selection[0].id).toBe(frame.id);
        expect(result.selection[0].stamp).toBe(frame.stamp);
      });
    });
  });

  describe("Frame merging issues during drag", () => {
    it("should maintain selection when dragged markers merge with unselected markers", () => {
      let testState: AnimationData = {
        ...createDefaultState(),
        framerate: 24,
        duration: 10000,
        selection: [],
        referenceMarker: null,
        dragState: null,
        tracks: {},
      };
      // Add more tracks with markers at various positions
      testState = {
        ...testState,
        tracks: {
          track1: {
            id: "track1",
            name: "Track 1",
            animatableId: "anim1",
            points: [
              { id: "point1", stamp: 0.1, value: 10 },
              { id: "point2", stamp: 0.2, value: 20 },
              { id: "point3", stamp: 0.3, value: 30 },
              { id: "point4", stamp: 0.45, value: 40 }, // Unselected marker at destination
              { id: "point5", stamp: 0.55, value: 50 }, // Unselected marker at destination
              { id: "point6", stamp: 0.65, value: 60 }, // Unselected marker at destination
            ],
          } as Track<RawValue>,
          track2: {
            id: "track2",
            name: "Track 2",
            animatableId: "anim2",
            points: [
              { id: "point7", stamp: 0.45, value: 70 }, // Already at destination
              { id: "point8", stamp: 0.55, value: 80 }, // Already at destination
              { id: "point9", stamp: 0.65, value: 90 }, // Already at destination
            ],
          } as Track<RawValue>,
        },
      };

      const initialFrames = computeFrames(testState.tracks);
      const sources = [{ trackId: "track1", type: "number" as const }];

      // Select the first three markers in track1
      const frame01 = initialFrames.find((f) => Math.abs(f.stamp - 0.1) < 0.001);
      const frame02 = initialFrames.find((f) => Math.abs(f.stamp - 0.2) < 0.001);
      const frame03 = initialFrames.find((f) => Math.abs(f.stamp - 0.3) < 0.001);

      expect(frame01).toBeDefined();
      expect(frame02).toBeDefined();
      expect(frame03).toBeDefined();

      testState.selection = [frame01!, frame02!, frame03!];
      testState.referenceMarker = {
        marker: frame01!,
        sources,
        isAddMode: false,
      };

      // Store original selected point IDs
      const selectedPointIds = new Set<string>();
      testState.selection.forEach((frame) => {
        frame.points.forEach((point) => {
          selectedPointIds.add(point.id);
        });
      });
      expect(selectedPointIds.size).toBe(3);

      // Drag them to positions where unselected markers already exist
      // This will cause frames to merge
      testState = produce(testState, (draft) => {
        startDragging(draft);
        updateDragDelta(draft, 0.35, false); // Move to 0.45, 0.55, 0.65
        commitDrag(draft);
      });

      // After drag, the frames will have merged with existing markers
      const newFrames = computeFrames(testState.tracks);

      // Frame at 0.45 should now have point1 (moved) + point4 (was there) + point7 (track2)
      const mergedFrame045 = newFrames.find((f) => Math.abs(f.stamp - 0.45) < 0.001);
      expect(mergedFrame045).toBeDefined();
      expect(mergedFrame045!.points.length).toBeGreaterThanOrEqual(1); // At least the moved point

      // Frame at 0.55 should have point2 (moved) + point5 (was there) + point8 (track2)
      const mergedFrame055 = newFrames.find((f) => Math.abs(f.stamp - 0.55) < 0.001);
      expect(mergedFrame055).toBeDefined();
      expect(mergedFrame055!.points.length).toBeGreaterThanOrEqual(1); // At least the moved point

      // Frame at 0.65 should have point3 (moved) + point6 (was there) + point9 (track2)
      const mergedFrame065 = newFrames.find((f) => Math.abs(f.stamp - 0.65) < 0.001);
      expect(mergedFrame065).toBeDefined();
      expect(mergedFrame065!.points.length).toBeGreaterThanOrEqual(1); // At least the moved point

      // IMPORTANT: The selection should still include the originally selected points
      // even though they're now part of larger merged frames
      const newSelectedPointIds = new Set<string>();
      testState.selection.forEach((frame) => {
        frame.points.forEach((point) => {
          if (selectedPointIds.has(point.id)) {
            newSelectedPointIds.add(point.id);
          }
        });
      });

      // All originally selected points should still be in selected frames
      expect(newSelectedPointIds.size).toBe(3);
      expect(newSelectedPointIds.has("point1")).toBe(true);
      expect(newSelectedPointIds.has("point2")).toBe(true);
      expect(newSelectedPointIds.has("point3")).toBe(true);

      // The selection should contain the merged frames
      expect(testState.selection.length).toBe(3);

      // Now deselect and try to select individual markers
      testState = produce(testState, (draft) => {
        draft.selection = [];
        draft.referenceMarker = null;
      });

      // Try to select just point2 (which is now in a merged frame at 0.55)
      const point2Frame = newFrames.find((f) => f.points.some((p) => p.id === "point2"));
      expect(point2Frame).toBeDefined();

      const result = computeMarkerSelection(
        point2Frame!,
        sources,
        newFrames,
        [],
        null,
        false,
        false,
      );

      // Should be able to select the frame containing point2
      expect(result.selection.length).toBe(1);
      expect(result.selection[0].points.some((p) => p.id === "point2")).toBe(true);
    });

    it("should handle shift-click selection when frames have merged", () => {
      let testState: AnimationData = {
        ...createDefaultState(),
        framerate: 24,
        duration: 10000,
        selection: [],
        referenceMarker: null,
        dragState: null,
        tracks: {},
      };
      // Setup: Create a situation where dragged markers will merge with existing ones
      testState = {
        ...testState,
        tracks: {
          track1: {
            id: "track1",
            name: "Track 1",
            animatableId: "anim1",
            points: [
              { id: "point1", stamp: 0.1, value: 10 },
              { id: "point2", stamp: 0.2, value: 20 },
              { id: "point3", stamp: 0.3, value: 30 },
              { id: "point4", stamp: 0.35, value: 35 }, // Will merge with moved point1
              { id: "point5", stamp: 0.45, value: 45 }, // Will merge with moved point2
              { id: "point6", stamp: 0.55, value: 55 }, // Will merge with moved point3
            ],
          } as Track<RawValue>,
        },
      };

      const initialFrames = computeFrames(testState.tracks);
      const sources = [{ trackId: "track1", type: "number" as const }];

      // Select first three markers
      const frame01 = initialFrames.find((f) => Math.abs(f.stamp - 0.1) < 0.001);
      const frame02 = initialFrames.find((f) => Math.abs(f.stamp - 0.2) < 0.001);
      const frame03 = initialFrames.find((f) => Math.abs(f.stamp - 0.3) < 0.001);

      testState.selection = [frame01!, frame02!, frame03!];

      // Drag to merge with existing markers
      testState = produce(testState, (draft) => {
        startDragging(draft);
        updateDragDelta(draft, 0.25, false); // Move to 0.35, 0.45, 0.55
        commitDrag(draft);
      });

      // Clear selection
      testState = produce(testState, (draft) => {
        draft.selection = [];
        draft.referenceMarker = null;
      });

      const newFrames = computeFrames(testState.tracks);

      // Try to select the first merged frame
      const mergedFrame035 = newFrames.find((f) => Math.abs(f.stamp - 0.35) < 0.001);
      expect(mergedFrame035).toBeDefined();
      expect(mergedFrame035!.points.length).toBe(2); // point1 (moved) + point4

      let result = computeMarkerSelection(
        mergedFrame035!,
        sources,
        newFrames,
        [],
        null,
        false,
        false,
      );

      testState = produce(testState, (draft) => {
        draft.selection = result.selection;
        draft.referenceMarker = result.reference;
      });

      // Shift-click to select range to the third merged frame
      const mergedFrame055 = newFrames.find((f) => Math.abs(f.stamp - 0.55) < 0.001);
      expect(mergedFrame055).toBeDefined();

      result = computeMarkerSelection(
        mergedFrame055!,
        sources,
        newFrames,
        testState.selection,
        testState.referenceMarker,
        true, // shift
        false,
      );

      // Should have selected the range including all merged frames
      expect(result.selection.length).toBe(3);
      expect(result.selection.some((f) => Math.abs(f.stamp - 0.35) < 0.001)).toBe(true);
      expect(result.selection.some((f) => Math.abs(f.stamp - 0.45) < 0.001)).toBe(true);
      expect(result.selection.some((f) => Math.abs(f.stamp - 0.55) < 0.001)).toBe(true);
    });
  });
});
