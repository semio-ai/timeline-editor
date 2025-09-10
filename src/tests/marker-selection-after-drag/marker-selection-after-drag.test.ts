import { describe, it, expect } from "vitest";
import { InstancedFrameInfo, Source } from "../../types";
import { computeMarkerSelection } from "../../functions/compute-marker-selection";

describe("Marker Selection After Drag", () => {
  // Helper function to create test markers
  const createMarker = (stamp: number, trackIds: string[], id?: string): InstancedFrameInfo => ({
    id: id || `marker-${stamp.toString()}-${trackIds.join("-")}`,
    stamp,
    points: trackIds.map((trackId) => ({
      id: `point-${trackId}-${stamp.toString()}`,
      trackId,
      value: stamp * 100,
    })),
  });

  // Helper function to create test sources
  const createSources = (trackIds: string[]): Source[] =>
    trackIds.map((trackId) => ({
      trackId,
      type: "number",
      label: `Track ${trackId}`,
    }));

  describe("Clicking marker after drag merges markers at same timestamp", () => {
    it("should select only the clicked marker's tracks, not all markers at the same timestamp", () => {
      // Scenario: After dragging, we have multiple markers at timestamp 0.5
      // - Marker A: track1
      // - Marker B: track2
      // - Marker C: track3
      // All are at the same timestamp after dragging

      const markerA = createMarker(0.5, ["track1"], "marker-a");
      const markerB = createMarker(0.5, ["track2"], "marker-b");
      const markerC = createMarker(0.5, ["track3"], "marker-c");

      // All markers in the track (after drag, all at 0.5)
      const allMarkers = [markerA, markerB, markerC];

      // Current state: nothing selected
      const currentSelection: InstancedFrameInfo[] = [];
      const currentReference = null;

      // Click on markerA (only track1 points)
      const clickedMarker = markerA;
      const clickedSources = createSources(["track1"]);

      const result = computeMarkerSelection(
        clickedMarker,
        clickedSources,
        allMarkers,
        currentSelection,
        currentReference,
        false, // no shift
        false, // no mod
      );

      // Should only select markerA (track1), not all markers at timestamp 0.5
      expect(result.selection).toHaveLength(1);
      expect(result.selection[0].points).toHaveLength(1);
      expect(result.selection[0].points[0].trackId).toBe("track1");
      expect(result.selection[0].stamp).toBe(0.5);

      // Reference should be set to the clicked marker
      expect(result.reference).not.toBeNull();
      expect(result.reference?.marker).toEqual(clickedMarker);
      expect(result.reference?.sources).toEqual(clickedSources);
    });

    it("should handle multi-select correctly when markers are at same timestamp", () => {
      // Scenario: Multiple markers at timestamp 0.5 after dragging
      const markerA = createMarker(0.5, ["track1"], "marker-a");
      const markerB = createMarker(0.5, ["track2"], "marker-b");
      const markerC = createMarker(0.5, ["track3"], "marker-c");

      const allMarkers = [markerA, markerB, markerC];

      // Start with markerA selected
      const currentSelection = [markerA];
      const currentReference = {
        marker: markerA,
        sources: createSources(["track1"]),
      };

      // Ctrl-click on markerB (should add only markerB, not all at 0.5)
      const clickedMarker = markerB;
      const clickedSources = createSources(["track2"]);

      const result = computeMarkerSelection(
        clickedMarker,
        clickedSources,
        allMarkers,
        currentSelection,
        currentReference,
        false, // no shift
        true, // mod key (ctrl/cmd)
      );

      // Should have both markerA and markerB selected (merged into one frame)
      expect(result.selection).toHaveLength(1);
      expect(result.selection[0].points).toHaveLength(2);

      const trackIds = result.selection[0].points.map((p) => p.trackId).sort();
      expect(trackIds).toEqual(["track1", "track2"]);

      // Should NOT include track3 (markerC)
      expect(trackIds).not.toContain("track3");
    });

    it("should handle the case where a merged frame is passed but only specific tracks should be selected", () => {
      // This simulates what happens in DataPoint component after drag:
      // The frame found contains all points at the timestamp,
      // but we filter it to only the clicked marker's points

      // Create a merged frame (what would be found after drag)
      const mergedFrame: InstancedFrameInfo = {
        id: "merged-frame",
        stamp: 0.5,
        points: [
          { id: "point-track1-0.5", trackId: "track1", value: 50 },
          { id: "point-track2-0.5", trackId: "track2", value: 50 },
          { id: "point-track3-0.5", trackId: "track3", value: 50 },
        ],
      };

      // Simulate clicking on just the track1 portion
      const clickedMarkerFrame: InstancedFrameInfo = {
        ...mergedFrame,
        points: mergedFrame.points.filter((p) => p.trackId === "track1"),
      };

      const allMarkers = [mergedFrame];
      const currentSelection: InstancedFrameInfo[] = [];
      const currentReference = null;

      const result = computeMarkerSelection(
        clickedMarkerFrame,
        createSources(["track1"]),
        allMarkers,
        currentSelection,
        currentReference,
        false,
        false,
      );

      // Should only select track1 points
      expect(result.selection).toHaveLength(1);
      expect(result.selection[0].points).toHaveLength(1);
      expect(result.selection[0].points[0].trackId).toBe("track1");
    });

    it("should preserve existing selection in other tracks when clicking after drag", () => {
      // Scenario: track1 and track2 are selected, both at different timestamps
      // After drag, track3 ends up at same timestamp as track1
      // Clicking track3 should select only track3, not track1

      const track1At05 = createMarker(0.5, ["track1"], "track1-marker");
      const track2At03 = createMarker(0.3, ["track2"], "track2-marker");
      const track3At05 = createMarker(0.5, ["track3"], "track3-marker"); // Same timestamp as track1

      const allMarkers = [track2At03, track1At05, track3At05];

      // Current selection: track1 and track2
      const currentSelection = [track2At03, track1At05];
      const currentReference = {
        marker: track1At05,
        sources: createSources(["track1"]),
      };

      // Click on track3 (without modifiers - should replace selection)
      const result = computeMarkerSelection(
        track3At05,
        createSources(["track3"]),
        allMarkers,
        currentSelection,
        currentReference,
        false,
        false,
      );

      // Should only have track3 selected
      expect(result.selection).toHaveLength(1);
      expect(result.selection[0].points).toHaveLength(1);
      expect(result.selection[0].points[0].trackId).toBe("track3");
      expect(result.selection[0].stamp).toBe(0.5);

      // Should NOT include track1 even though it's at the same timestamp
      const selectedTrackIds = result.selection[0].points.map((p) => p.trackId);
      expect(selectedTrackIds).not.toContain("track1");
      expect(selectedTrackIds).not.toContain("track2");
    });
  });

  describe("Edge cases with timestamp collisions", () => {
    it("should handle toggling selection when markers share timestamp", () => {
      // Multiple markers at 0.5, with track1 already selected
      const track1Marker = createMarker(0.5, ["track1"]);
      const track2Marker = createMarker(0.5, ["track2"]);

      const allMarkers = [track1Marker, track2Marker];

      // track1 is currently selected
      const currentSelection = [track1Marker];
      const currentReference = {
        marker: track1Marker,
        sources: createSources(["track1"]),
      };

      // Ctrl-click on track1 again (should deselect it)
      const result = computeMarkerSelection(
        track1Marker,
        createSources(["track1"]),
        allMarkers,
        currentSelection,
        currentReference,
        false,
        true, // mod key
      );

      // Should have empty selection
      expect(result.selection).toHaveLength(0);
      expect(result.reference).toBeNull();
    });

    it("should handle range selection when markers have been merged at endpoints", () => {
      // After drag: markers at 0.3, 0.5, 0.7
      // At 0.5, there are two tracks (track1 and track2)
      const marker03 = createMarker(0.3, ["track1"]);
      const marker05Track1 = createMarker(0.5, ["track1"]);
      const marker05Track2 = createMarker(0.5, ["track2"]);
      const marker07 = createMarker(0.7, ["track1"]);

      const allMarkers = [marker03, marker05Track1, marker05Track2, marker07];

      // Click on marker at 0.3
      const currentSelection = [marker03];
      const currentReference = {
        marker: marker03,
        sources: createSources(["track1"]),
      };

      // Shift-click on marker at 0.7 (track1)
      const result = computeMarkerSelection(
        marker07,
        createSources(["track1"]),
        allMarkers,
        currentSelection,
        currentReference,
        true, // shift
        false,
      );

      // Should select range from 0.3 to 0.7 for track1 only
      expect(result.selection).toHaveLength(3);

      // Check that we have markers at 0.3, 0.5, and 0.7
      const stamps = result.selection.map((s) => s.stamp).sort((a, b) => a - b);
      expect(stamps).toEqual([0.3, 0.5, 0.7]);

      // All selected markers should only have track1 points
      result.selection.forEach((marker) => {
        expect(marker.points.every((p) => p.trackId === "track1")).toBe(true);
      });

      // Should NOT include track2 even though it's at 0.5
      const hasTrack2 = result.selection.some((marker) =>
        marker.points.some((p) => p.trackId === "track2"),
      );
      expect(hasTrack2).toBe(false);
    });
  });
});
