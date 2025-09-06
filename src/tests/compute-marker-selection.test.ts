import { describe, it, expect } from "vitest";
import { computeMarkerSelection } from "../functions/compute-marker-selection";
import { InstancedFrameInfo, Source } from "../types";

// Test wrapper to simplify test calls - just passes through to computeMarkerSelection
function testComputeMarkerSelection(
  clickedMarker: InstancedFrameInfo,
  clickedSources: Source[],
  allMarkersInTrack: InstancedFrameInfo[],
  currentSelection: InstancedFrameInfo[],
  currentReference: { marker: InstancedFrameInfo; sources: Source[] } | null,
  shift?: boolean,
  mod?: boolean,
): {
  selection: InstancedFrameInfo[];
  reference: { marker: InstancedFrameInfo; sources: Source[] } | null;
} {
  return computeMarkerSelection(
    clickedMarker,
    clickedSources,
    allMarkersInTrack,
    currentSelection,
    currentReference,
    shift,
    mod,
  );
}

describe("computeMarkerSelection", () => {
  // Helper function to create test markers
  const createMarker = (stamp: number, trackIds: string[], id?: string): InstancedFrameInfo => ({
    id: id || `marker-${stamp.toString()}`,
    stamp,
    points: trackIds.map((trackId) => ({
      id: `point-${trackId}-${stamp.toString()}`,
      trackId,
      value: stamp * 100, // Arbitrary value
    })),
  });

  // Helper function to create test sources
  const createSources = (trackIds: string[]): Source[] =>
    trackIds.map((trackId) => ({
      trackId,
      type: "number" as const,
    }));

  // Test data setup
  const allMarkers: InstancedFrameInfo[] = [
    createMarker(0.1, ["track1", "track2"]),
    createMarker(0.2, ["track1", "track2"]),
    createMarker(0.3, ["track1", "track2"]),
    createMarker(0.4, ["track1", "track2"]),
    createMarker(0.5, ["track1", "track2", "track3"]),
    createMarker(0.6, ["track2", "track3"]),
    createMarker(0.7, ["track3"]),
    createMarker(0.8, ["track1", "track3"]),
    createMarker(0.9, ["track1", "track2", "track3"]),
  ];

  describe("No modifier keys (click)", () => {
    it("should replace selection and set reference when clicking a new marker", () => {
      const currentSelection = [createMarker(0.2, ["track1"])];
      const currentReference = {
        marker: createMarker(0.2, ["track1"]),
        sources: createSources(["track1"]),
      };
      const clickedMarker = createMarker(0.5, ["track1"]);
      const clickedSources = createSources(["track1"]);

      const result = testComputeMarkerSelection(
        clickedMarker,
        clickedSources,
        allMarkers,
        currentSelection,
        currentReference,
        false, // shift
        false, // mod
      );

      expect(result.selection).toHaveLength(1);
      expect(result.selection[0].stamp).toBe(0.5);
      expect(result.reference).toBeDefined();
      expect(result.reference?.marker.stamp).toBe(0.5);
      expect(result.reference?.sources).toEqual(clickedSources);
    });

    it("should always replace selection even when clicking the same marker", () => {
      const marker = createMarker(0.3, ["track1", "track2"]);
      const sources = createSources(["track1", "track2"]);
      const currentSelection = [marker];
      const currentReference = { marker, sources };

      const result = testComputeMarkerSelection(
        marker,
        sources,
        allMarkers,
        currentSelection,
        currentReference,
        false, // shift
        false, // mod
      );

      // Should still have the marker selected (replaced with itself)
      expect(result.selection).toHaveLength(1);
      expect(result.selection[0].stamp).toBe(0.3);
      expect(result.reference?.marker.stamp).toBe(0.3);
    });

    it("should handle clicking on different tracks", () => {
      const currentSelection = [createMarker(0.2, ["track1"])];
      const currentReference = {
        marker: createMarker(0.2, ["track1"]),
        sources: createSources(["track1"]),
      };
      const clickedMarker = createMarker(0.5, ["track2"]);
      const clickedSources = createSources(["track2"]);

      const result = testComputeMarkerSelection(
        clickedMarker,
        clickedSources,
        allMarkers,
        currentSelection,
        currentReference,
        false, // shift
        false, // mod
      );

      expect(result.selection).toHaveLength(1);
      expect(result.selection[0].stamp).toBe(0.5);
      expect(result.reference?.sources).toEqual(clickedSources);
    });
  });

  describe("Ctrl/Cmd key (multi-select)", () => {
    it("should add single marker to selection and set reference", () => {
      const currentSelection = [createMarker(0.2, ["track1"])];
      const currentReference = {
        marker: createMarker(0.2, ["track1"]),
        sources: createSources(["track1"]),
      };
      const clickedMarker = createMarker(0.5, ["track2"]);
      const clickedSources = createSources(["track2"]);

      const result = testComputeMarkerSelection(
        clickedMarker,
        clickedSources,
        allMarkers,
        currentSelection,
        currentReference,
        false, // shift
        true, // mod
      );

      expect(result.selection).toHaveLength(2);
      expect(result.selection.some((m) => m.stamp === 0.2)).toBe(true);
      expect(result.selection.some((m) => m.stamp === 0.5)).toBe(true);
      expect(result.reference?.marker.stamp).toBe(0.5);
      expect(result.reference?.sources).toEqual(clickedSources);
    });

    it("should toggle off when ctrl-clicking an already selected marker", () => {
      const marker = createMarker(0.3, ["track1"]);
      const sources = createSources(["track1"]);
      const currentSelection = [createMarker(0.1, ["track1"]), marker];
      const currentReference = { marker, sources };

      const result = testComputeMarkerSelection(
        marker,
        sources,
        allMarkers,
        currentSelection,
        currentReference,
        false, // shift
        true, // mod
      );

      expect(result.selection).toHaveLength(1);
      expect(result.selection[0].stamp).toBe(0.1);
      expect(result.reference).toBeNull(); // Reference cleared when toggled off
    });

    it("should clear reference when toggling off the reference marker", () => {
      const marker1 = createMarker(0.2, ["track1"]);
      const marker2 = createMarker(0.3, ["track1"]);
      const sources2 = createSources(["track1"]);
      const currentSelection = [marker1, marker2];
      const currentReference = {
        marker: marker2,
        sources: sources2,
      };

      const result = testComputeMarkerSelection(
        marker2,
        sources2,
        allMarkers,
        currentSelection,
        currentReference,
        false, // shift
        true, // mod
      );

      expect(result.selection).toHaveLength(1);
      expect(result.selection[0].stamp).toBe(0.2);
      expect(result.reference).toBeNull();
    });

    it("should merge points at same timestamp", () => {
      const currentSelection = [createMarker(0.5, ["track1"])];
      const currentReference = {
        marker: createMarker(0.5, ["track1"]),
        sources: createSources(["track1"]),
      };
      const clickedMarker = createMarker(0.5, ["track2"]);
      const clickedSources = createSources(["track2"]);

      const result = testComputeMarkerSelection(
        clickedMarker,
        clickedSources,
        allMarkers,
        currentSelection,
        currentReference,
        false, // shift
        true, // mod
      );

      expect(result.selection).toHaveLength(1);
      expect(result.selection[0].stamp).toBe(0.5);
      expect(result.selection[0].points).toHaveLength(2);
      expect(result.selection[0].points.some((p) => p.trackId === "track1")).toBe(true);
      expect(result.selection[0].points.some((p) => p.trackId === "track2")).toBe(true);
      expect(result.reference?.marker.stamp).toBe(0.5);
      expect(result.reference?.sources).toEqual(clickedSources);
    });
  });

  describe("Shift key (range selection)", () => {
    it("should select range between reference and clicked marker in same track", () => {
      const referenceMarker = createMarker(0.2, ["track1", "track2"]);
      const referenceSources = createSources(["track1", "track2"]);
      const currentSelection = [referenceMarker];
      const currentReference = {
        marker: referenceMarker,
        sources: referenceSources,
      };
      const clickedMarker = createMarker(0.4, ["track1", "track2"]);
      const clickedSources = createSources(["track1", "track2"]);

      const result = testComputeMarkerSelection(
        clickedMarker,
        clickedSources,
        allMarkers,
        currentSelection,
        currentReference,
        true, // shift
        false, // mod
      );

      // Should include markers from 0.2 to 0.4 in tracks 1 and 2
      expect(result.selection).toHaveLength(3);
      const stamps = result.selection.map((m) => m.stamp).sort((a, b) => a - b);
      expect(stamps).toEqual([0.2, 0.3, 0.4]);
      // Reference should NOT be updated
      expect(result.reference?.marker.stamp).toBe(0.2);
      expect(result.reference?.sources).toEqual(referenceSources);
    });

    it("should add single marker and set reference when shift-clicking different track", () => {
      const referenceMarker = createMarker(0.2, ["track1"]);
      const referenceSources = createSources(["track1"]);
      const currentSelection = [referenceMarker];
      const currentReference = {
        marker: referenceMarker,
        sources: referenceSources,
      };
      const clickedMarker = createMarker(0.7, ["track3"]);
      const clickedSources = createSources(["track3"]);

      const result = testComputeMarkerSelection(
        clickedMarker,
        clickedSources,
        allMarkers,
        currentSelection,
        currentReference,
        true, // shift
        false, // mod
      );

      // Should add single marker (not range) and update reference
      expect(result.selection).toHaveLength(2);
      expect(result.selection.some((m) => m.stamp === 0.2)).toBe(true);
      expect(result.selection.some((m) => m.stamp === 0.7)).toBe(true);
      expect(result.reference?.marker.stamp).toBe(0.7);
      expect(result.reference?.sources).toEqual(clickedSources);
    });

    it("should handle shift-click with no reference", () => {
      const currentSelection = [createMarker(0.2, ["track1"])];
      const clickedMarker = createMarker(0.5, ["track2"]);
      const clickedSources = createSources(["track2"]);

      const result = testComputeMarkerSelection(
        clickedMarker,
        clickedSources,
        allMarkers,
        currentSelection,
        null, // no reference
        true, // shift
        false, // mod
      );

      // Should add single marker and set as reference
      expect(result.selection).toHaveLength(2);
      expect(result.selection.some((m) => m.stamp === 0.2)).toBe(true);
      expect(result.selection.some((m) => m.stamp === 0.5)).toBe(true);
      expect(result.reference?.marker.stamp).toBe(0.5);
      expect(result.reference?.sources).toEqual(clickedSources);
    });

    it("should select range only for matching track sources", () => {
      const referenceMarker = createMarker(0.1, ["track1", "track2"]);
      const referenceSources = createSources(["track1", "track2"]);
      const currentSelection = [referenceMarker];
      const currentReference = {
        marker: referenceMarker,
        sources: referenceSources,
      };
      const clickedMarker = createMarker(0.5, ["track1", "track2"]);
      const clickedSources = createSources(["track1", "track2"]);

      const result = testComputeMarkerSelection(
        clickedMarker,
        clickedSources,
        allMarkers,
        currentSelection,
        currentReference,
        true, // shift
        false, // mod
      );

      // Should select all markers from 0.1 to 0.5 that have track1 or track2
      expect(result.selection).toHaveLength(5);
      const stamps = result.selection.map((m) => m.stamp).sort((a, b) => a - b);
      expect(stamps).toEqual([0.1, 0.2, 0.3, 0.4, 0.5]);

      // Verify only track1 and track2 points are included
      result.selection.forEach((marker) => {
        marker.points.forEach((point) => {
          expect(["track1", "track2"]).toContain(point.trackId);
        });
      });

      // Reference should not change
      expect(result.reference?.marker.stamp).toBe(0.1);
    });

    it("should handle range selection with existing multi-selection", () => {
      const referenceMarker = createMarker(0.3, ["track1"]);
      const referenceSources = createSources(["track1"]);
      const currentSelection = [
        createMarker(0.1, ["track2"]), // Different track selection
        referenceMarker,
        createMarker(0.7, ["track3"]), // Another different track
      ];
      const currentReference = {
        marker: referenceMarker,
        sources: referenceSources,
      };
      const clickedMarker = createMarker(0.5, ["track1"]);
      const clickedSources = createSources(["track1"]);

      const result = testComputeMarkerSelection(
        clickedMarker,
        clickedSources,
        allMarkers,
        currentSelection,
        currentReference,
        true, // shift
        false, // mod
      );

      // Should preserve selections in other tracks (track2, track3)
      // but replace selection in track1 with the new range
      const stamps = result.selection.map((m) => m.stamp).sort((a, b) => a - b);
      expect(stamps).toEqual([0.1, 0.3, 0.4, 0.5, 0.7]); // track2 (0.1) + track1 range (0.3-0.5) + track3 (0.7)

      // Reference should not change
      expect(result.reference?.marker.stamp).toBe(0.3);
    });

    it("should handle different track source configurations", () => {
      // Test with sources that have different lengths but same track IDs
      const referenceMarker = createMarker(0.2, ["track1"]);
      const referenceSources = createSources(["track1"]);
      const currentSelection = [referenceMarker];
      const currentReference = {
        marker: referenceMarker,
        sources: referenceSources,
      };

      // Click on marker with additional tracks
      const clickedMarker = createMarker(0.5, ["track1", "track2"]);
      const clickedSources = createSources(["track1", "track2"]); // Different sources

      const result = testComputeMarkerSelection(
        clickedMarker,
        clickedSources,
        allMarkers,
        currentSelection,
        currentReference,
        true, // shift
        false, // mod
      );

      // Should add as single marker since sources don't match exactly
      expect(result.selection).toHaveLength(2);
      expect(result.selection.some((m) => m.stamp === 0.2)).toBe(true);
      expect(result.selection.some((m) => m.stamp === 0.5)).toBe(true);
      expect(result.reference?.marker.stamp).toBe(0.5); // Updated reference
      expect(result.reference?.sources).toEqual(clickedSources);
    });
  });

  describe("Shift+Mod combination", () => {
    it("should behave like ctrl-click for adding", () => {
      const currentSelection = [createMarker(0.2, ["track1"])];
      const currentReference = {
        marker: createMarker(0.2, ["track1"]),
        sources: createSources(["track1"]),
      };
      const clickedMarker = createMarker(0.5, ["track2"]);
      const clickedSources = createSources(["track2"]);

      const result = testComputeMarkerSelection(
        clickedMarker,
        clickedSources,
        allMarkers,
        currentSelection,
        currentReference,
        true, // shift
        true, // mod
      );

      // Should add single marker, not range
      expect(result.selection).toHaveLength(2);
      expect(result.selection.some((m) => m.stamp === 0.2)).toBe(true);
      expect(result.selection.some((m) => m.stamp === 0.5)).toBe(true);
      expect(result.reference?.marker.stamp).toBe(0.5);
    });

    it("should toggle off with shift+mod like ctrl", () => {
      const marker = createMarker(0.3, ["track1"]);
      const sources = createSources(["track1"]);
      const currentSelection = [marker];
      const currentReference = { marker, sources };

      const result = testComputeMarkerSelection(
        marker,
        sources,
        allMarkers,
        currentSelection,
        currentReference,
        true, // shift
        true, // mod
      );

      expect(result.selection).toHaveLength(0);
      expect(result.reference).toBeNull();
    });
  });

  describe("Complex selection scenarios", () => {
    it("should handle subset relationships correctly", () => {
      const wideMarker = createMarker(0.5, ["track1", "track2", "track3"]);
      const wideSources = createSources(["track1", "track2", "track3"]);
      const narrowMarker = createMarker(0.5, ["track2"]);
      const narrowSources = createSources(["track2"]);

      // Select wide marker first
      const currentSelection = [wideMarker];
      const currentReference = { marker: wideMarker, sources: wideSources };

      // Click on narrow marker (subset)
      const result = testComputeMarkerSelection(
        narrowMarker,
        narrowSources,
        allMarkers,
        currentSelection,
        currentReference,
        false, // shift
        false, // mod
      );

      // Should replace with narrow marker
      expect(result.selection).toHaveLength(1);
      expect(result.selection[0].points).toHaveLength(1);
      expect(result.selection[0].points[0].trackId).toBe("track2");
      expect(result.reference?.sources).toEqual(narrowSources);
    });

    it("should handle empty selection correctly", () => {
      const clickedMarker = createMarker(0.5, ["track1"]);
      const clickedSources = createSources(["track1"]);

      const result = testComputeMarkerSelection(
        clickedMarker,
        clickedSources,
        allMarkers,
        [],
        null,
        false, // shift
        false, // mod
      );

      expect(result.selection).toHaveLength(1);
      expect(result.selection[0].stamp).toBe(0.5);
      expect(result.reference?.marker.stamp).toBe(0.5);
    });

    it("should handle empty allMarkers array", () => {
      const referenceMarker = createMarker(0.2, ["track1"]);
      const referenceSources = createSources(["track1"]);
      const currentSelection = [referenceMarker];
      const currentReference = { marker: referenceMarker, sources: referenceSources };
      const clickedMarker = createMarker(0.5, ["track1"]);
      const clickedSources = createSources(["track1"]);

      const result = testComputeMarkerSelection(
        clickedMarker,
        clickedSources,
        [], // empty allMarkers
        currentSelection,
        currentReference,
        true, // shift - would normally create range
        false, // mod
      );

      // With empty allMarkers, can't build range, selection stays unchanged
      expect(result.selection).toHaveLength(1);
      expect(result.selection[0].stamp).toBe(0.2);
      expect(result.reference?.marker.stamp).toBe(0.2); // Reference unchanged
    });

    it("should handle range selection across gaps", () => {
      // Create markers with gaps
      const sparseMarkers = [
        createMarker(0.1, ["track1"]),
        createMarker(0.2, ["track1"]),
        // gap at 0.3 and 0.4
        createMarker(0.5, ["track1"]),
      ];

      const referenceMarker = createMarker(0.1, ["track1"]);
      const referenceSources = createSources(["track1"]);
      const currentSelection = [referenceMarker];
      const currentReference = { marker: referenceMarker, sources: referenceSources };
      const clickedMarker = createMarker(0.5, ["track1"]);
      const clickedSources = createSources(["track1"]);

      const result = testComputeMarkerSelection(
        clickedMarker,
        clickedSources,
        sparseMarkers,
        currentSelection,
        currentReference,
        true, // shift
        false, // mod
      );

      // Should include all markers between 0.1 and 0.5 that exist
      expect(result.selection).toHaveLength(3);
      const stamps = result.selection.map((m) => m.stamp).sort((a, b) => a - b);
      expect(stamps).toEqual([0.1, 0.2, 0.5]);
      expect(result.reference?.marker.stamp).toBe(0.1); // Reference unchanged
    });

    it("should maintain reference through multiple range selections", () => {
      const referenceMarker = createMarker(0.3, ["track1"]);
      const referenceSources = createSources(["track1"]);

      // First range selection
      const result1 = testComputeMarkerSelection(
        createMarker(0.5, ["track1"]),
        createSources(["track1"]),
        allMarkers,
        [referenceMarker],
        { marker: referenceMarker, sources: referenceSources },
        true, // shift
        false, // mod
      );

      expect(result1.reference?.marker.stamp).toBe(0.3); // Reference unchanged
      // Should only have markers from 0.3 to 0.5
      expect(result1.selection.map((m) => m.stamp).sort((a, b) => a - b)).toEqual([0.3, 0.4, 0.5]);

      // Second range selection from same reference
      const result2 = testComputeMarkerSelection(
        createMarker(0.1, ["track1"]),
        createSources(["track1"]),
        allMarkers,
        result1.selection,
        result1.reference,
        true, // shift
        false, // mod
      );

      expect(result2.reference?.marker.stamp).toBe(0.3); // Reference still unchanged
      // New range should be ONLY from 0.1 to 0.3 (replaces previous selection)
      const stamps = result2.selection.map((m) => m.stamp).sort((a, b) => a - b);
      expect(stamps).toEqual([0.1, 0.2, 0.3]);
    });

    it("should replace selection when shift-clicking in same track (not merge)", () => {
      const referenceMarker = createMarker(0.3, ["track1"]);
      const referenceSources = createSources(["track1"]);

      // First: Click a3 to set reference
      const result1 = testComputeMarkerSelection(
        referenceMarker,
        referenceSources,
        allMarkers,
        [],
        null,
        false, // shift
        false, // mod
      );
      expect(result1.selection).toHaveLength(1);
      expect(result1.selection[0].stamp).toBe(0.3);
      expect(result1.reference?.marker.stamp).toBe(0.3);

      // Second: Shift-click a5 (should select a3-a5)
      const result2 = testComputeMarkerSelection(
        createMarker(0.5, ["track1"]),
        createSources(["track1"]),
        allMarkers,
        result1.selection,
        result1.reference,
        true, // shift
        false, // mod
      );
      expect(result2.selection.map((m) => m.stamp).sort((a, b) => a - b)).toEqual([0.3, 0.4, 0.5]);
      expect(result2.reference?.marker.stamp).toBe(0.3); // Reference unchanged

      // Third: Shift-click a1 (should select a1-a3, NOT a1-a5)
      const result3 = testComputeMarkerSelection(
        createMarker(0.1, ["track1"]),
        createSources(["track1"]),
        allMarkers,
        result2.selection,
        result2.reference,
        true, // shift
        false, // mod
      );
      // Should REPLACE selection with range from reference (0.3) to clicked (0.1)
      expect(result3.selection.map((m) => m.stamp).sort((a, b) => a - b)).toEqual([0.1, 0.2, 0.3]);
      expect(result3.reference?.marker.stamp).toBe(0.3); // Reference still unchanged
    });

    it("should handle ctrl-click removing non-reference marker", () => {
      const marker1 = createMarker(0.2, ["track1"]);
      const marker2 = createMarker(0.3, ["track1"]);
      const sources1 = createSources(["track1"]);
      const sources2 = createSources(["track1"]);

      const currentSelection = [marker1, marker2];
      const currentReference = { marker: marker2, sources: sources2 }; // marker2 is reference

      // Ctrl-click to remove marker1 (not the reference)
      const result = testComputeMarkerSelection(
        marker1,
        sources1,
        allMarkers,
        currentSelection,
        currentReference,
        false, // shift
        true, // mod
      );

      expect(result.selection).toHaveLength(1);
      expect(result.selection[0].stamp).toBe(0.3);
      expect(result.reference?.marker.stamp).toBe(0.3); // Reference unchanged
    });

    it("should handle multi-track shift-click selection", () => {
      // Setup: Two tracks with different markers
      const allMarkersMultiTrack: InstancedFrameInfo[] = [
        createMarker(0.1, ["trackA"]), // a1
        createMarker(0.2, ["trackA"]), // a2
        createMarker(0.3, ["trackA"]), // a3
        createMarker(0.4, ["trackA"]), // a4
        createMarker(0.5, ["trackA"]), // a5
        createMarker(0.1, ["trackB"]), // b1
        createMarker(0.2, ["trackB"]), // b2
        createMarker(0.3, ["trackB"]), // b3
        createMarker(0.4, ["trackB"]), // b4
      ];

      // Step 1: Select a1-a3 with a3 as reference
      const sourcesA = createSources(["trackA"]);
      const result1 = testComputeMarkerSelection(
        createMarker(0.3, ["trackA"]),
        sourcesA,
        allMarkersMultiTrack,
        [],
        null,
        false, // shift
        false, // mod
      );

      // Then shift-click a1 to get range a1-a3
      const result2 = testComputeMarkerSelection(
        createMarker(0.1, ["trackA"]),
        sourcesA,
        allMarkersMultiTrack,
        result1.selection,
        result1.reference,
        true, // shift
        false, // mod
      );

      expect(result2.selection.map((m) => m.stamp).sort((a, b) => a - b)).toEqual([0.1, 0.2, 0.3]);
      expect(result2.selection.every((m) => m.points[0].trackId === "trackA")).toBe(true);
      expect(result2.reference?.marker.stamp).toBe(0.3);

      // Step 2: Ctrl-click b2 to add it and make it the new reference
      const sourcesB = createSources(["trackB"]);
      const result3 = testComputeMarkerSelection(
        createMarker(0.2, ["trackB"]),
        sourcesB,
        allMarkersMultiTrack,
        result2.selection,
        result2.reference,
        false, // shift
        true, // mod (ctrl)
      );

      // Should have a1-a3 + b2
      // Note: a2 and b2 at timestamp 0.2 merge into one marker with both track points
      expect(result3.selection).toHaveLength(3); // 3 unique timestamps: 0.1, 0.2 (merged), 0.3
      const hasTrackA = (m: InstancedFrameInfo) => m.points.some((p) => p.trackId === "trackA");
      const hasTrackB = (m: InstancedFrameInfo) => m.points.some((p) => p.trackId === "trackB");
      const trackAMarkers = result3.selection.filter(hasTrackA);
      const trackBMarkers = result3.selection.filter(hasTrackB);
      expect(trackAMarkers.map((m) => m.stamp).sort((a, b) => a - b)).toEqual([0.1, 0.2, 0.3]);
      expect(trackBMarkers.map((m) => m.stamp)).toEqual([0.2]);

      // Check that the marker at 0.2 has both track points
      const markerAt02 = result3.selection.find((m) => m.stamp === 0.2);
      expect(markerAt02).toBeDefined();
      expect(markerAt02?.points).toHaveLength(2);
      expect(markerAt02?.points.some((p) => p.trackId === "trackA")).toBe(true);
      expect(markerAt02?.points.some((p) => p.trackId === "trackB")).toBe(true);

      expect(result3.reference?.marker.stamp).toBe(0.2);
      expect(result3.reference?.sources[0].trackId).toBe("trackB");

      // Step 3: Shift-click b4 to get a1-a3 + b2-b4
      const result4 = testComputeMarkerSelection(
        createMarker(0.4, ["trackB"]),
        sourcesB,
        allMarkersMultiTrack,
        result3.selection,
        result3.reference,
        true, // shift
        false, // mod
      );

      // Should have a1-a3 (preserved) + b2-b4 (new range in trackB)
      // Markers at same timestamp merge: a2+b2 at 0.2, a3+b3 at 0.3
      expect(result4.selection).toHaveLength(4); // timestamps: 0.1, 0.2 (merged), 0.3 (merged), 0.4
      const hasFinalTrackA = (m: InstancedFrameInfo) =>
        m.points.some((p) => p.trackId === "trackA");
      const hasFinalTrackB = (m: InstancedFrameInfo) =>
        m.points.some((p) => p.trackId === "trackB");
      const finalTrackAMarkers = result4.selection.filter(hasFinalTrackA);
      const finalTrackBMarkers = result4.selection.filter(hasFinalTrackB);

      // Track A should still have a1-a3
      expect(finalTrackAMarkers.map((m) => m.stamp).sort((a, b) => a - b)).toEqual([0.1, 0.2, 0.3]);

      // Track B should have b2-b4
      expect(finalTrackBMarkers.map((m) => m.stamp).sort((a, b) => a - b)).toEqual([0.2, 0.3, 0.4]);

      // Verify merged markers
      const finalMarkerAt02 = result4.selection.find((m) => m.stamp === 0.2);
      const finalMarkerAt03 = result4.selection.find((m) => m.stamp === 0.3);
      expect(finalMarkerAt02?.points).toHaveLength(2); // a2 + b2
      expect(finalMarkerAt03?.points).toHaveLength(2); // a3 + b3

      // Reference should still be b2
      expect(result4.reference?.marker.stamp).toBe(0.2);
      expect(result4.reference?.sources[0].trackId).toBe("trackB");

      // Step 4: Shift-click b1 - should REPLACE b2-b4 with b1-b2 (not add to it)
      const result5 = testComputeMarkerSelection(
        createMarker(0.1, ["trackB"]),
        sourcesB,
        allMarkersMultiTrack,
        result4.selection,
        result4.reference,
        true, // shift
        false, // mod
      );

      // Should have a1-a3 (preserved) + b1-b2 (replaced range in trackB)
      // The range in track B should be REPLACED, not accumulated
      expect(result5.selection).toHaveLength(3); // timestamps: 0.1 (merged), 0.2 (merged), 0.3
      const result5TrackA = result5.selection.filter((m) =>
        m.points.some((p) => p.trackId === "trackA"),
      );
      const result5TrackB = result5.selection.filter((m) =>
        m.points.some((p) => p.trackId === "trackB"),
      );

      // Track A should still have a1-a3
      expect(result5TrackA.map((m) => m.stamp).sort((a, b) => a - b)).toEqual([0.1, 0.2, 0.3]);

      // Track B should now have b1-b2 (NOT b1-b4)
      expect(result5TrackB.map((m) => m.stamp).sort((a, b) => a - b)).toEqual([0.1, 0.2]);

      // Verify merged markers
      const result5MarkerAt01 = result5.selection.find((m) => m.stamp === 0.1);
      const result5MarkerAt02 = result5.selection.find((m) => m.stamp === 0.2);
      expect(result5MarkerAt01?.points).toHaveLength(2); // a1 + b1
      expect(result5MarkerAt02?.points).toHaveLength(2); // a2 + b2

      // Reference should still be b2
      expect(result5.reference?.marker.stamp).toBe(0.2);
      expect(result5.reference?.sources[0].trackId).toBe("trackB");
    });

    it("should replace range in reference track when shift-clicking backwards after ctrl-click", () => {
      // User's specific scenario:
      // 1. Click marker a3 in track A
      // 2. Ctrl-click b3 in track B
      // 3. Shift-click b5 (should have a3 + b3-b5)
      // 4. Shift-click b1 (should have a3 + b1-b3, NOT a3 + b1-b5)

      const allMarkersMultiTrack: InstancedFrameInfo[] = [
        createMarker(0.3, ["trackA"]), // a3
        createMarker(0.1, ["trackB"]), // b1
        createMarker(0.2, ["trackB"]), // b2
        createMarker(0.3, ["trackB"]), // b3
        createMarker(0.4, ["trackB"]), // b4
        createMarker(0.5, ["trackB"]), // b5
      ];

      // Step 1: Click a3 in track A
      const sourcesA = createSources(["trackA"]);
      const result1 = testComputeMarkerSelection(
        createMarker(0.3, ["trackA"]),
        sourcesA,
        allMarkersMultiTrack,
        [],
        null,
        false, // shift
        false, // mod
      );

      expect(result1.selection).toHaveLength(1);
      expect(result1.selection[0].stamp).toBe(0.3);
      expect(result1.selection[0].points[0].trackId).toBe("trackA");

      // Step 2: Ctrl-click b3 in track B
      const sourcesB = createSources(["trackB"]);
      const result2 = testComputeMarkerSelection(
        createMarker(0.3, ["trackB"]),
        sourcesB,
        allMarkersMultiTrack,
        result1.selection,
        result1.reference,
        false, // shift
        true, // mod (ctrl)
      );

      expect(result2.selection).toHaveLength(1); // Single marker with both tracks
      expect(result2.selection[0].stamp).toBe(0.3);
      expect(result2.selection[0].points).toHaveLength(2);
      expect(result2.selection[0].points.some((p) => p.trackId === "trackA")).toBe(true);
      expect(result2.selection[0].points.some((p) => p.trackId === "trackB")).toBe(true);
      expect(result2.reference?.marker.stamp).toBe(0.3);
      expect(result2.reference?.sources[0].trackId).toBe("trackB");

      // Step 3: Shift-click b5 (should have a3 + b3-b5)
      const result3 = testComputeMarkerSelection(
        createMarker(0.5, ["trackB"]),
        sourcesB,
        allMarkersMultiTrack,
        result2.selection,
        result2.reference,
        true, // shift
        false, // mod
      );

      expect(result3.selection).toHaveLength(3); // 0.3 (a3+b3), 0.4 (b4), 0.5 (b5)
      const result3TrackA = result3.selection.filter((m) =>
        m.points.some((p) => p.trackId === "trackA"),
      );
      const result3TrackB = result3.selection.filter((m) =>
        m.points.some((p) => p.trackId === "trackB"),
      );

      expect(result3TrackA.map((m) => m.stamp)).toEqual([0.3]); // Only a3
      expect(result3TrackB.map((m) => m.stamp).sort((a, b) => a - b)).toEqual([0.3, 0.4, 0.5]); // b3-b5
      expect(result3.reference?.marker.stamp).toBe(0.3); // Reference unchanged
      expect(result3.reference?.sources[0].trackId).toBe("trackB");

      // Step 4: Shift-click b1 (should REPLACE b3-b5 with b1-b3, keeping a3)
      const result4 = testComputeMarkerSelection(
        createMarker(0.1, ["trackB"]),
        sourcesB,
        allMarkersMultiTrack,
        result3.selection,
        result3.reference,
        true, // shift
        false, // mod
      );

      // Should have a3 + b1-b3 (NOT b1-b5)
      expect(result4.selection).toHaveLength(3); // 0.1 (b1), 0.2 (b2), 0.3 (a3+b3)
      const result4TrackA = result4.selection.filter((m) =>
        m.points.some((p) => p.trackId === "trackA"),
      );
      const result4TrackB = result4.selection.filter((m) =>
        m.points.some((p) => p.trackId === "trackB"),
      );

      expect(result4TrackA.map((m) => m.stamp)).toEqual([0.3]); // Still only a3
      expect(result4TrackB.map((m) => m.stamp).sort((a, b) => a - b)).toEqual([0.1, 0.2, 0.3]); // b1-b3 (NOT b1-b5)
      expect(result4.reference?.marker.stamp).toBe(0.3); // Reference unchanged
      expect(result4.reference?.sources[0].trackId).toBe("trackB");
    });

    it("should remove single track from multi-track marker on ctrl-click", () => {
      // Test removing one track's point from a multi-track marker at the same timestamp
      // E.g., if a2 and b4 are at the same stamp and both selected, ctrl-clicking a2
      // should remove only a2, leaving b4 selected

      const stamp = 0.2;

      // Create points with explicit IDs that will be shared between markers
      const pointA = {
        id: `point-trackA-${stamp.toString()}`,
        trackId: "trackA",
        value: stamp * 100,
      };
      const pointB = {
        id: `point-trackB-${stamp.toString()}`,
        trackId: "trackB",
        value: stamp * 100,
      };

      // Start with both tracks selected at the same timestamp
      const combinedMarker: InstancedFrameInfo = {
        id: `marker-${stamp.toString()}`,
        stamp,
        points: [pointA, pointB],
      };

      // Create marker with just trackA (using the same point object)
      const trackAMarker: InstancedFrameInfo = {
        id: `marker-trackA-${stamp.toString()}`,
        stamp,
        points: [pointA],
      };

      const allMarkersMultiTrack = [trackAMarker];
      const currentSelection = [combinedMarker];
      const currentReference = {
        marker: combinedMarker,
        sources: createSources(["trackA", "trackB"]),
      };

      // Ctrl-click on trackA point to remove it
      const result = testComputeMarkerSelection(
        trackAMarker,
        createSources(["trackA"]),
        allMarkersMultiTrack,
        currentSelection,
        currentReference,
        false, // shift
        true, // mod (ctrl)
      );

      // Should have only trackB remaining
      expect(result.selection).toHaveLength(1);
      expect(result.selection[0].stamp).toBe(stamp);
      expect(result.selection[0].points).toHaveLength(1);
      expect(result.selection[0].points[0].trackId).toBe("trackB");

      // Reference should be updated to just trackB (not cleared entirely)
      // When we remove some tracks from the reference, it should update to the remaining tracks
      expect(result.reference).not.toBeNull();
      if (result.reference) {
        expect(result.reference.marker.points).toHaveLength(1);
        expect(result.reference.marker.points[0].trackId).toBe("trackB");
        expect(result.reference.sources).toHaveLength(1);
        expect(result.reference.sources[0].trackId).toBe("trackB");
      }
    });

    it("should handle multi-segment selection within the same track", () => {
      // This tests the scenario where:
      // 1. Click a1 (sets reference)
      // 2. Shift-click a3 (selects a1-a3, keeps a1 as reference)
      // 3. Ctrl-click a5 (adds a5, sets it as new reference)
      // 4. Shift-click a7 (should ADD a5-a7 to existing a1-a3, not replace)

      const trackMarkers: InstancedFrameInfo[] = [
        createMarker(0.1, ["track1"]), // a1
        createMarker(0.2, ["track1"]), // a2
        createMarker(0.3, ["track1"]), // a3
        createMarker(0.4, ["track1"]), // a4
        createMarker(0.5, ["track1"]), // a5
        createMarker(0.6, ["track1"]), // a6
        createMarker(0.7, ["track1"]), // a7
      ];
      const sources = createSources(["track1"]);

      // Step 1: Click a1 to set reference
      const result1 = testComputeMarkerSelection(
        createMarker(0.1, ["track1"]),
        sources,
        trackMarkers,
        [],
        null,
        false, // shift
        false, // mod
      );
      expect(result1.selection).toHaveLength(1);
      expect(result1.selection[0].stamp).toBe(0.1);
      expect(result1.reference?.marker.stamp).toBe(0.1);

      // Step 2: Shift-click a3 (should select a1-a3)
      const result2 = testComputeMarkerSelection(
        createMarker(0.3, ["track1"]),
        sources,
        trackMarkers,
        result1.selection,
        result1.reference,
        true, // shift
        false, // mod
      );
      expect(result2.selection.map((m) => m.stamp).sort((a, b) => a - b)).toEqual([0.1, 0.2, 0.3]);
      expect(result2.reference?.marker.stamp).toBe(0.1); // Reference unchanged

      // Step 3: Ctrl-click a5 (should add a5 and set it as new reference)
      const result3 = testComputeMarkerSelection(
        createMarker(0.5, ["track1"]),
        sources,
        trackMarkers,
        result2.selection,
        result2.reference,
        false, // shift
        true, // mod (ctrl)
      );
      expect(result3.selection.map((m) => m.stamp).sort((a, b) => a - b)).toEqual([
        0.1, 0.2, 0.3, 0.5,
      ]);
      expect(result3.reference?.marker.stamp).toBe(0.5); // New reference

      // Step 4: Shift-click a7 (should ADD a5-a7 to existing selection, not replace)
      const result4 = testComputeMarkerSelection(
        createMarker(0.7, ["track1"]),
        sources,
        trackMarkers,
        result3.selection,
        result3.reference,
        true, // shift
        false, // mod
      );

      // EXPECTED: a1-a3 should be preserved, and a5-a7 should be added
      expect(result4.selection.map((m) => m.stamp).sort((a, b) => a - b)).toEqual([
        0.1, 0.2, 0.3, 0.5, 0.6, 0.7,
      ]);
      expect(result4.reference?.marker.stamp).toBe(0.5); // Reference unchanged
    });

    it("should accumulate multiple shift-click ranges from isolated reference", () => {
      // This tests that when a reference is isolated (added via ctrl-click),
      // multiple shift-clicks from that reference continue to add to the selection
      // rather than replacing it.

      const trackMarkers: InstancedFrameInfo[] = [
        createMarker(0.1, ["track1"]), // a1
        createMarker(0.2, ["track1"]), // a2
        createMarker(0.3, ["track1"]), // a3
        createMarker(0.4, ["track1"]), // a4
        createMarker(0.5, ["track1"]), // a5
        createMarker(0.6, ["track1"]), // a6
        createMarker(0.7, ["track1"]), // a7
        createMarker(0.8, ["track1"]), // a8
      ];
      const sources = createSources(["track1"]);

      // Step 1: Click a1-a3 range
      const result1 = testComputeMarkerSelection(
        createMarker(0.1, ["track1"]),
        sources,
        trackMarkers,
        [],
        null,
        false, // shift
        false, // mod
      );

      const result2 = testComputeMarkerSelection(
        createMarker(0.3, ["track1"]),
        sources,
        trackMarkers,
        result1.selection,
        result1.reference,
        true, // shift
        false, // mod
      );
      expect(result2.selection.map((m) => m.stamp).sort((a, b) => a - b)).toEqual([0.1, 0.2, 0.3]);

      // Step 2: Ctrl-click a5 (isolated)
      const result3 = testComputeMarkerSelection(
        createMarker(0.5, ["track1"]),
        sources,
        trackMarkers,
        result2.selection,
        result2.reference,
        false, // shift
        true, // mod (ctrl)
      );
      expect(result3.selection.map((m) => m.stamp).sort((a, b) => a - b)).toEqual([
        0.1, 0.2, 0.3, 0.5,
      ]);
      expect(result3.reference?.marker.stamp).toBe(0.5);

      // Step 3: First shift-click to a6 (should ADD a5-a6)
      const result4 = testComputeMarkerSelection(
        createMarker(0.6, ["track1"]),
        sources,
        trackMarkers,
        result3.selection,
        result3.reference,
        true, // shift
        false, // mod
      );
      expect(result4.selection.map((m) => m.stamp).sort((a, b) => a - b)).toEqual([
        0.1, 0.2, 0.3, 0.5, 0.6,
      ]);
      expect(result4.reference?.marker.stamp).toBe(0.5); // Reference unchanged

      // Step 4: Second shift-click to a8 (should STILL ADD, extending a5-a8)
      const result5 = testComputeMarkerSelection(
        createMarker(0.8, ["track1"]),
        sources,
        trackMarkers,
        result4.selection,
        result4.reference,
        true, // shift
        false, // mod
      );
      // Should have a1-a3 preserved, and a5-a8 as the extended range
      expect(result5.selection.map((m) => m.stamp).sort((a, b) => a - b)).toEqual([
        0.1, 0.2, 0.3, 0.5, 0.6, 0.7, 0.8,
      ]);
      expect(result5.reference?.marker.stamp).toBe(0.5); // Reference still unchanged

      // Step 5: Third shift-click back to a4 (should still ADD, now a4-a5)
      const result6 = testComputeMarkerSelection(
        createMarker(0.4, ["track1"]),
        sources,
        trackMarkers,
        result5.selection,
        result5.reference,
        true, // shift
        false, // mod
      );
      // The existing a1-a3 and a5-a8 should be preserved, and a4-a5 added
      // This merges into a contiguous a1-a8
      expect(result6.selection.map((m) => m.stamp).sort((a, b) => a - b)).toEqual([
        0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8,
      ]);
      expect(result6.reference?.marker.stamp).toBe(0.5); // Reference still unchanged
    });
  });
});
