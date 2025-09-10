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

describe("Last Marker Selection Issue", () => {
  let mockState: AnimationData;

  beforeEach(() => {
    // Initialize with a single track containing multiple markers
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

  it("should reproduce the last marker selection issue after multi-select and drag", () => {
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

    // Shift-click to select range to third marker (frame04 is the LAST marker)
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

    // Verify three markers are selected and frame04 is the last
    expect(mockState.selection.length).toBe(3);
    expect(mockState.selection[mockState.selection.length - 1].points[0].id).toBe("point4");

    // Store the selection order for verification
    const selectionOrder = mockState.selection.map((f) => f.points[0].id);
    expect(selectionOrder).toEqual(["point2", "point3", "point4"]);

    // Step 2: Drag the selected markers
    mockState = produce(mockState, (draft) => {
      startDragging(draft);
      updateDragDelta(draft, 0.25, false); // Move to 0.45, 0.55, 0.65
      commitDrag(draft);
    });

    // Verify markers moved
    expect(mockState.selection.length).toBe(3);
    expect(mockState.selection.some((f) => Math.abs(f.stamp - 0.45) < 0.001)).toBe(true);
    expect(mockState.selection.some((f) => Math.abs(f.stamp - 0.55) < 0.001)).toBe(true);
    expect(mockState.selection.some((f) => Math.abs(f.stamp - 0.65) < 0.001)).toBe(true);

    // Step 3: Clear selection (simulating click in empty space)
    mockState = produce(mockState, (draft) => {
      draft.selection = [];
      draft.referenceMarker = null;
    });

    // Get updated frames after drag
    const newFrames = computeFrames(mockState.tracks);

    // Step 4: Try to select each of the previously moved markers individually

    // Try selecting the FIRST moved marker (originally point2, now at 0.45)
    const movedFrame045 = newFrames.find((f) => Math.abs(f.stamp - 0.45) < 0.001);
    expect(movedFrame045).toBeDefined();
    expect(movedFrame045!.points[0].id).toBe("point2");

    result = computeMarkerSelection(movedFrame045!, sources, newFrames, [], null, false, false);

    // First marker should be selectable
    expect(result.selection.length).toBe(1);
    expect(result.selection[0].points[0].id).toBe("point2");

    // Try selecting the MIDDLE moved marker (originally point3, now at 0.55)
    const movedFrame055 = newFrames.find((f) => Math.abs(f.stamp - 0.55) < 0.001);
    expect(movedFrame055).toBeDefined();
    expect(movedFrame055!.points[0].id).toBe("point3");

    result = computeMarkerSelection(movedFrame055!, sources, newFrames, [], null, false, false);

    // Middle marker should be selectable
    expect(result.selection.length).toBe(1);
    expect(result.selection[0].points[0].id).toBe("point3");

    // Try selecting the LAST moved marker (originally point4, now at 0.65)
    const movedFrame065 = newFrames.find((f) => Math.abs(f.stamp - 0.65) < 0.001);
    expect(movedFrame065).toBeDefined();
    expect(movedFrame065!.points[0].id).toBe("point4");

    result = computeMarkerSelection(movedFrame065!, sources, newFrames, [], null, false, false);

    // ISSUE: According to the bug report, the LAST marker might not be selectable
    // This test verifies if the selection logic works correctly
    expect(result.selection.length).toBe(1);
    expect(result.selection[0].points[0].id).toBe("point4");

    // Now test that range selection including the last marker works
    const unmovedFrame01 = newFrames.find((f) => Math.abs(f.stamp - 0.1) < 0.001);

    // Select an unmoved marker first
    result = computeMarkerSelection(unmovedFrame01!, sources, newFrames, [], null, false, false);

    const tempSelection = result.selection;
    const tempReference = result.reference;

    // Shift-click to the problematic last marker
    result = computeMarkerSelection(
      movedFrame065!,
      sources,
      newFrames,
      tempSelection,
      tempReference,
      true, // shift for range selection
      false,
    );

    // Range selection should work and include the last marker
    expect(result.selection.length).toBeGreaterThan(1);
    expect(result.selection.some((f) => Math.abs(f.stamp - 0.65) < 0.001)).toBe(true);
    const lastMarkerInRange = result.selection.find((f) => Math.abs(f.stamp - 0.65) < 0.001);
    expect(lastMarkerInRange).toBeDefined();
    expect(lastMarkerInRange!.points[0].id).toBe("point4");
  });

  it("should test if the issue is related to which marker initiates the drag", () => {
    const initialFrames = computeFrames(mockState.tracks);
    const sources = [{ trackId: "track1", type: "number" as const }];

    // Multi-select three markers
    const frame02 = initialFrames.find((f) => Math.abs(f.stamp - 0.2) < 0.001);
    const frame03 = initialFrames.find((f) => Math.abs(f.stamp - 0.3) < 0.001);
    const frame04 = initialFrames.find((f) => Math.abs(f.stamp - 0.4) < 0.001);

    mockState = produce(mockState, (draft) => {
      draft.selection = [frame02!, frame03!, frame04!];
      draft.referenceMarker = {
        marker: frame02!,
        sources,
        isAddMode: false,
      };
    });

    // Test scenario 1: Drag initiated from the LAST marker
    // In the UI, this would be clicking and dragging from point4
    // The drag logic doesn't distinguish which marker initiated it,
    // but the UI component that received the drag event might behave differently

    mockState = produce(mockState, (draft) => {
      startDragging(draft);
      updateDragDelta(draft, 0.25, false);
      commitDrag(draft);
    });

    // Check if all markers are still properly selectable
    const newFrames = computeFrames(mockState.tracks);

    // Clear selection
    mockState = produce(mockState, (draft) => {
      draft.selection = [];
      draft.referenceMarker = null;
    });

    // Try selecting each moved marker
    [0.45, 0.55, 0.65].forEach((stamp) => {
      const frame = newFrames.find((f) => Math.abs(f.stamp - stamp) < 0.001);
      expect(frame).toBeDefined();

      const result = computeMarkerSelection(frame!, sources, newFrames, [], null, false, false);

      expect(result.selection.length).toBe(1);
      expect(result.selection[0].stamp).toBeCloseTo(stamp, 3);
    });
  });

  it("should test if the issue persists with different selection orders", () => {
    const initialFrames = computeFrames(mockState.tracks);
    const sources = [{ trackId: "track1", type: "number" as const }];

    // Test selecting in reverse order (last to first)
    const frame04 = initialFrames.find((f) => Math.abs(f.stamp - 0.4) < 0.001);
    const frame02 = initialFrames.find((f) => Math.abs(f.stamp - 0.2) < 0.001);

    // Start with frame04
    let result = computeMarkerSelection(frame04!, sources, initialFrames, [], null, false, false);

    mockState = produce(mockState, (draft) => {
      draft.selection = result.selection;
      draft.referenceMarker = result.reference;
    });

    // Shift-click to frame02 (selecting backwards)
    result = computeMarkerSelection(
      frame02!,
      sources,
      initialFrames,
      mockState.selection,
      mockState.referenceMarker,
      true,
      false,
    );

    mockState = produce(mockState, (draft) => {
      draft.selection = result.selection;
      draft.referenceMarker = result.reference;
    });

    // Verify selection order
    expect(mockState.selection.length).toBe(3);
    // In this case, frame02 is the "last" in the interaction sequence

    // Drag and test
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

    // Try selecting the marker that was "last" in the interaction (frame02, now at 0.45)
    const movedFrame045 = newFrames.find((f) => Math.abs(f.stamp - 0.45) < 0.001);
    expect(movedFrame045).toBeDefined();

    result = computeMarkerSelection(movedFrame045!, sources, newFrames, [], null, false, false);

    // Should be selectable
    expect(result.selection.length).toBe(1);
    expect(result.selection[0].points[0].id).toBe("point2");
  });

  it("should test if the issue is related to reference marker state", () => {
    const initialFrames = computeFrames(mockState.tracks);
    const sources = [{ trackId: "track1", type: "number" as const }];

    // Multi-select with the last marker as reference
    const frame02 = initialFrames.find((f) => Math.abs(f.stamp - 0.2) < 0.001);
    const frame03 = initialFrames.find((f) => Math.abs(f.stamp - 0.3) < 0.001);
    const frame04 = initialFrames.find((f) => Math.abs(f.stamp - 0.4) < 0.001);

    mockState = produce(mockState, (draft) => {
      draft.selection = [frame02!, frame03!, frame04!];
      // Set the LAST marker as the reference
      draft.referenceMarker = {
        marker: frame04!,
        sources,
        isAddMode: false,
      };
    });

    // Verify reference is the last marker
    expect(mockState.referenceMarker?.marker.points[0].id).toBe("point4");

    // Drag
    mockState = produce(mockState, (draft) => {
      startDragging(draft);
      updateDragDelta(draft, 0.25, false);
      commitDrag(draft);
    });

    // After drag, reference should be updated
    expect(mockState.referenceMarker?.marker.stamp).toBeCloseTo(0.65, 3);

    // Clear selection AND reference
    mockState = produce(mockState, (draft) => {
      draft.selection = [];
      draft.referenceMarker = null;
    });

    // Verify reference is cleared
    expect(mockState.referenceMarker).toBeNull();

    const newFrames = computeFrames(mockState.tracks);

    // Try selecting the former reference marker
    const movedFrame065 = newFrames.find((f) => Math.abs(f.stamp - 0.65) < 0.001);

    const result = computeMarkerSelection(
      movedFrame065!,
      sources,
      newFrames,
      [],
      null,
      false,
      false,
    );

    // Should be selectable even though it was the reference
    expect(result.selection.length).toBe(1);
    expect(result.selection[0].points[0].id).toBe("point4");
  });
});
