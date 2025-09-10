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

describe("Individual Selection After Drag Issue", () => {
  let mockState: AnimationData;

  beforeEach(() => {
    // Initialize with a single track containing multiple markers
    // This setup specifically reproduces the reported issue
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
            { id: "point9", stamp: 0.9, value: 90 },
          ],
        } as Track<RawValue>,
      },
    };
  });

  it("should reproduce the exact issue: individual selection fails after drag but range selection works", () => {
    const initialFrames = computeFrames(mockState.tracks);
    const sources = [{ trackId: "track1", type: "number" as const }];

    // Step 1: Multi-select three markers (simulating shift-click range selection)
    const frame02 = initialFrames.find((f) => Math.abs(f.stamp - 0.2) < 0.001);
    const frame03 = initialFrames.find((f) => Math.abs(f.stamp - 0.3) < 0.001);
    const frame04 = initialFrames.find((f) => Math.abs(f.stamp - 0.4) < 0.001);

    expect(frame02).toBeDefined();
    expect(frame03).toBeDefined();
    expect(frame04).toBeDefined();

    // Select first marker
    let result = computeMarkerSelection(frame02!, sources, initialFrames, [], null, false, false);

    mockState = produce(mockState, (draft) => {
      draft.selection = result.selection;
      draft.referenceMarker = result.reference;
    });

    // Shift-click to select range to third marker
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
    const selectedPointIds = new Set(mockState.selection.flatMap((f) => f.points.map((p) => p.id)));
    expect(selectedPointIds.has("point2")).toBe(true);
    expect(selectedPointIds.has("point3")).toBe(true);
    expect(selectedPointIds.has("point4")).toBe(true);

    // Step 2: Drag the selected markers
    mockState = produce(mockState, (draft) => {
      startDragging(draft);
      updateDragDelta(draft, 0.25, false); // Move to 0.45, 0.55, 0.65
      commitDrag(draft);
    });

    // Verify markers moved and selection is maintained
    expect(mockState.selection.length).toBe(3);
    expect(mockState.selection.some((f) => Math.abs(f.stamp - 0.45) < 0.001)).toBe(true);
    expect(mockState.selection.some((f) => Math.abs(f.stamp - 0.55) < 0.001)).toBe(true);
    expect(mockState.selection.some((f) => Math.abs(f.stamp - 0.65) < 0.001)).toBe(true);

    // Step 3: Deselect by clearing selection (simulating click in empty space)
    mockState = produce(mockState, (draft) => {
      draft.selection = [];
      draft.referenceMarker = null;
    });

    // Get updated frames after drag
    const newFrames = computeFrames(mockState.tracks);

    // Step 4: Try to select one of the moved markers individually
    // According to the issue, this might fail
    const movedFrame055 = newFrames.find((f) => Math.abs(f.stamp - 0.55) < 0.001);
    expect(movedFrame055).toBeDefined();
    expect(movedFrame055!.points.length).toBe(1);
    expect(movedFrame055!.points[0].id).toBe("point3");

    // Attempt individual selection
    result = computeMarkerSelection(
      movedFrame055!,
      sources,
      newFrames,
      [],
      null,
      false, // no shift
      false, // no mod
    );

    // This SHOULD work - individual selection should be possible
    expect(result.selection.length).toBe(1);
    expect(result.selection[0].stamp).toBeCloseTo(0.55, 3);
    expect(result.selection[0].points[0].id).toBe("point3");

    // Clear selection again
    mockState = produce(mockState, (draft) => {
      draft.selection = [];
      draft.referenceMarker = null;
    });

    // Step 5: Verify range selection works even if individual selection had issues
    // Select an unmoved marker first
    const unmovedFrame01 = newFrames.find((f) => Math.abs(f.stamp - 0.1) < 0.001);
    expect(unmovedFrame01).toBeDefined();

    result = computeMarkerSelection(unmovedFrame01!, sources, newFrames, [], null, false, false);

    mockState = produce(mockState, (draft) => {
      draft.selection = result.selection;
      draft.referenceMarker = result.reference;
    });

    // Now shift-click to the problematic moved marker
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

    // The previously "unselectable" marker should be in the range
    const includedMarker = result.selection.find((f) => Math.abs(f.stamp - 0.55) < 0.001);
    expect(includedMarker).toBeDefined();
    expect(includedMarker!.points[0].id).toBe("point3");
  });

  it("should test if the issue is related to frame ID changes after drag", () => {
    const initialFrames = computeFrames(mockState.tracks);

    // Select markers
    const frame02 = initialFrames.find((f) => Math.abs(f.stamp - 0.2) < 0.001);
    const frame03 = initialFrames.find((f) => Math.abs(f.stamp - 0.3) < 0.001);
    const frame04 = initialFrames.find((f) => Math.abs(f.stamp - 0.4) < 0.001);

    mockState.selection = [frame02!, frame03!, frame04!];

    // Store original frame IDs
    const originalIds = mockState.selection.map((f) => f.id);
    expect(originalIds).toEqual(["point2", "point3", "point4"]);

    // Drag the selection
    mockState = produce(mockState, (draft) => {
      startDragging(draft);
      updateDragDelta(draft, 0.25, false);
      commitDrag(draft);
    });

    // Check if frame IDs are consistent after drag
    const newFrames = computeFrames(mockState.tracks);
    const movedFrame045 = newFrames.find((f) => Math.abs(f.stamp - 0.45) < 0.001);
    const movedFrame055 = newFrames.find((f) => Math.abs(f.stamp - 0.55) < 0.001);
    const movedFrame065 = newFrames.find((f) => Math.abs(f.stamp - 0.65) < 0.001);

    expect(movedFrame045!.id).toBe("point2");
    expect(movedFrame055!.id).toBe("point3");
    expect(movedFrame065!.id).toBe("point4");

    // Verify frame comparison works correctly
    const comparison045 = compareInstancedFrames(movedFrame045!, mockState.selection[0]);
    const comparison055 = compareInstancedFrames(movedFrame055!, mockState.selection[1]);
    const comparison065 = compareInstancedFrames(movedFrame065!, mockState.selection[2]);

    expect(comparison045).toBe(FrameComparison.Equal);
    expect(comparison055).toBe(FrameComparison.Equal);
    expect(comparison065).toBe(FrameComparison.Equal);
  });

  it("should test if the issue occurs when dragged markers land near other markers", () => {
    // Add markers at positions where we'll drag to
    mockState = produce(mockState, (draft) => {
      draft.tracks.track1.points.push(
        { id: "point10", stamp: 0.449, value: 100 },
        { id: "point11", stamp: 0.451, value: 110 },
      );
      // Sort points by stamp
      draft.tracks.track1.points.sort((a, b) => a.stamp - b.stamp);
    });

    const initialFrames = computeFrames(mockState.tracks);
    const sources = [{ trackId: "track1", type: "number" as const }];

    // Select three markers
    const frame02 = initialFrames.find((f) => Math.abs(f.stamp - 0.2) < 0.001);
    const frame03 = initialFrames.find((f) => Math.abs(f.stamp - 0.3) < 0.001);
    const frame04 = initialFrames.find((f) => Math.abs(f.stamp - 0.4) < 0.001);

    mockState = produce(mockState, (draft) => {
      draft.selection = [frame02!, frame03!, frame04!];
    });

    // Drag them near the existing markers
    mockState = produce(mockState, (draft) => {
      startDragging(draft);
      updateDragDelta(draft, 0.25, false); // Move to 0.45, 0.55, 0.65
      commitDrag(draft);
    });

    // Clear selection
    mockState = produce(mockState, (draft) => {
      draft.selection = [];
      draft.referenceMarker = null;
    });

    const newFrames = computeFrames(mockState.tracks);

    // Check if markers at 0.45 are properly separated from nearby markers
    const frame0449 = newFrames.find((f) => Math.abs(f.stamp - 0.449) < 0.001);
    const frame045 = newFrames.find((f) => Math.abs(f.stamp - 0.45) < 0.001);
    const frame0451 = newFrames.find((f) => Math.abs(f.stamp - 0.451) < 0.001);

    expect(frame0449).toBeDefined();
    expect(frame045).toBeDefined();
    expect(frame0451).toBeDefined();

    // They should be separate frames
    expect(frame0449!.id).toBe("point10");
    expect(frame045!.id).toBe("point2");
    expect(frame0451!.id).toBe("point11");

    // Try to select the moved marker at 0.45
    const result = computeMarkerSelection(frame045!, sources, newFrames, [], null, false, false);

    // Should be able to select it individually
    expect(result.selection.length).toBe(1);
    expect(result.selection[0].id).toBe("point2");
    expect(result.selection[0].stamp).toBeCloseTo(0.45, 3);
  });

  it("should verify that the allData array is correctly updated after drag", () => {
    const initialFrames = computeFrames(mockState.tracks);
    const sources = [{ trackId: "track1", type: "number" as const }];

    // Select and drag markers
    const frame02 = initialFrames.find((f) => Math.abs(f.stamp - 0.2) < 0.001);
    const frame03 = initialFrames.find((f) => Math.abs(f.stamp - 0.3) < 0.001);

    mockState.selection = [frame02!, frame03!];

    // Store initial frame count
    const initialFrameCount = initialFrames.length;
    expect(initialFrameCount).toBe(9); // 9 points in track1

    // Drag the selection
    mockState = produce(mockState, (draft) => {
      startDragging(draft);
      updateDragDelta(draft, 0.35, false);
      commitDrag(draft);
    });

    // Get updated frames
    const newFrames = computeFrames(mockState.tracks);

    // Frame count should still be the same
    expect(newFrames.length).toBe(initialFrameCount);

    // Verify all frames are at their expected positions
    const expectedStamps = [0.1, 0.4, 0.5, 0.55, 0.6, 0.65, 0.7, 0.8, 0.9];
    expectedStamps.forEach((stamp) => {
      const frame = newFrames.find((f) => Math.abs(f.stamp - stamp) < 0.001);
      expect(frame).toBeDefined();
    });

    // Verify the allData array would be correct for range selection
    const frame01 = newFrames.find((f) => Math.abs(f.stamp - 0.1) < 0.001);
    const frame055 = newFrames.find((f) => Math.abs(f.stamp - 0.55) < 0.001);

    // Simulate range selection
    let result = computeMarkerSelection(frame01!, sources, newFrames, [], null, false, false);

    const tempSelection = result.selection;
    const tempReference = result.reference;

    result = computeMarkerSelection(
      frame055!,
      sources,
      newFrames,
      tempSelection,
      tempReference,
      true, // shift
      false,
    );

    // Should select all frames in range
    const selectedStamps = result.selection.map((f) => f.stamp);
    expect(selectedStamps).toContain(0.1);
    expect(selectedStamps).toContain(0.4);
    expect(selectedStamps).toContain(0.5);
    expect(selectedStamps).toContain(0.55);
  });
});
