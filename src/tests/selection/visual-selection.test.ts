/**
 * Test to verify that markers are visually selected based only on their selectable points
 * This ensures global markers appear selected when clicking track markers, even when
 * the global marker contains non-selectable points from other instances.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  createTestAnimationStore,
  NAMESPACE_IDS,
  INSTANCE_IDS,
  TRACK_IDS,
} from "../../test-fixtures/animation-store-factory";
import type { AnimationStore } from "../../store";
import { createMarkerPath } from "../../functions/selection-state-manager";

describe("Visual Selection: Selectable Points Only", () => {
  let store: AnimationStore;

  beforeEach(async () => {
    // Create a fresh store for each test
    store = createTestAnimationStore({
      includeNamespaceA: true,
      includeNamespaceB: true,
      activeInstance: INSTANCE_IDS.ALPHA_SHARED,
    });

    // Initialize subscriptions
    const cleanup = store.getState().initAnimationSubscriptions();

    // Wait for subscriptions to initialize
    await new Promise((resolve) => setTimeout(resolve, 10));
  });

  it("should show global marker as selected when clicking track marker (ignoring non-selectable points)", async () => {
    const state = store.getState();

    // Setup: Get the track marker from alpha instance
    const trackRowId = `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${TRACK_IDS.OPACITY}`;
    const trackMarkerId = "o1";

    const trackMarkerData = state.computedRowData[trackRowId]?.virtualFrames.find(
      (f) => f.id === trackMarkerId,
    );

    console.log("\n=== Track Marker Points ===");
    console.log("Track marker points:", trackMarkerData?.points);

    // Get the global marker that contains this point
    const globalRowId = "global";
    const globalMarkerId = "o1-o1";

    const globalMarkerData = state.computedRowData[globalRowId]?.virtualFrames.find(
      (f) => f.id === globalMarkerId,
    );

    console.log("\n=== Global Marker Points ===");
    console.log(
      "Global marker points:",
      globalMarkerData?.points?.map((p) => ({
        id: p.id,
        instanceId: p.instanceId,
        selectable: p.selectable,
      })),
    );

    // The global marker should have:
    // - One selectable point from alpha instance
    // - One non-selectable point from beta instance
    expect(globalMarkerData?.points?.length).toBe(2);
    const selectableGlobalPoints = globalMarkerData?.points?.filter((p) => p.selectable);
    const nonSelectableGlobalPoints = globalMarkerData?.points?.filter((p) => !p.selectable);
    expect(selectableGlobalPoints?.length).toBe(1);
    expect(nonSelectableGlobalPoints?.length).toBe(1);

    // Click the track marker
    const selectableTrackPoints =
      trackMarkerData?.points?.filter((p) => p.selectable !== false) || [];
    const trackPath = createMarkerPath(trackRowId, trackMarkerId);

    console.log("\n=== Clicking Track Marker ===");
    store.getState().clickMarker(selectableTrackPoints, trackPath, false, false);

    const stateAfterClick = store.getState();

    // Check what got selected
    console.log("\n=== Selection State ===");
    console.log("Selected paths:", stateAfterClick.selectionState.paths);

    // Both markers should be in the selection
    const trackMarkerPath = createMarkerPath(trackRowId, trackMarkerId);
    const globalMarkerPath = createMarkerPath(globalRowId, globalMarkerId);

    expect(stateAfterClick.selectionState.pathSet.has(trackMarkerPath)).toBe(true);
    expect(stateAfterClick.selectionState.pathSet.has(globalMarkerPath)).toBe(true);

    // Now simulate checking if the global marker should appear selected
    // This mimics the logic in data-point.tsx
    const shouldGlobalAppearSelected = checkIfMarkerShouldAppearSelected(
      stateAfterClick,
      globalRowId,
      globalMarkerId,
    );

    console.log("\n=== Visual Selection Check ===");
    console.log("Global marker should appear selected:", shouldGlobalAppearSelected);

    expect(shouldGlobalAppearSelected).toBe(true);
  });

  it("should show track marker as selected when clicking global marker", async () => {
    const state = store.getState();

    // Setup: Get the global marker
    const globalRowId = "global";
    const globalMarkerId = "o1-o1";

    const globalMarkerData = state.computedRowData[globalRowId]?.virtualFrames.find(
      (f) => f.id === globalMarkerId,
    );

    // Click the global marker (only with selectable points)
    const selectableGlobalPoints = globalMarkerData?.points?.filter((p) => p.selectable) || [];
    const globalPath = createMarkerPath(globalRowId, globalMarkerId);

    console.log("\n=== Clicking Global Marker ===");
    console.log("Selectable points being clicked:", selectableGlobalPoints.length);
    store.getState().clickMarker(selectableGlobalPoints, globalPath, false, false);

    const stateAfterClick = store.getState();

    // Check what got selected
    console.log("\n=== Selection State ===");
    console.log("Selected paths:", stateAfterClick.selectionState.paths);

    // Check if track marker should appear selected
    const trackRowId = `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${TRACK_IDS.OPACITY}`;
    const trackMarkerId = "o1";

    const shouldTrackAppearSelected = checkIfMarkerShouldAppearSelected(
      stateAfterClick,
      trackRowId,
      trackMarkerId,
    );

    console.log("\n=== Visual Selection Check ===");
    console.log("Track marker should appear selected:", shouldTrackAppearSelected);

    expect(shouldTrackAppearSelected).toBe(true);
  });

  it("should handle mixed selectable/non-selectable points correctly", async () => {
    const state = store.getState();

    // Test with opacity marker to ensure we have a simple, predictable case
    const trackRowId = `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${TRACK_IDS.OPACITY}`;
    const globalRowId = "global";

    // Find an opacity marker
    const trackMarkers = state.computedRowData[trackRowId]?.virtualFrames || [];
    const trackMarker = trackMarkers.find((m) => m.id === "o2"); // Use o2 for variety

    if (trackMarker) {
      const selectablePoints = trackMarker.points?.filter((p) => p.selectable !== false) || [];
      const trackPath = createMarkerPath(trackRowId, trackMarker.id);

      console.log("\n=== Testing Marker with Mixed Points ===");
      console.log("Track marker ID:", trackMarker.id);
      console.log("Total points:", trackMarker.points?.length);
      console.log("Selectable points:", selectablePoints.length);

      // Click the track marker
      store.getState().clickMarker(selectablePoints, trackPath, false, false);

      const stateAfterClick = store.getState();

      // Find corresponding global markers
      const globalMarkers = state.computedRowData[globalRowId]?.virtualFrames || [];
      let foundMatchingGlobal = false;
      let foundFullyCoveredGlobal = false;

      for (const globalMarker of globalMarkers) {
        // Check if this global marker contains any of our track's points
        const hasMatchingPoint = globalMarker.points?.some((gp) =>
          selectablePoints.some(
            (tp) =>
              gp.id === tp.id &&
              gp.namespaceId === tp.namespaceId &&
              gp.instanceId === tp.instanceId &&
              gp.trackId === tp.trackId,
          ),
        );

        if (hasMatchingPoint) {
          foundMatchingGlobal = true;

          // Check which selectable points in the global marker are covered
          const globalSelectablePoints = globalMarker.points?.filter((p) => p.selectable) || [];
          const coveredPoints = globalSelectablePoints.filter((gp) =>
            stateAfterClick.selectionState.paths.some((path) => {
              const [rowId, mId] = path.split("#");
              const rowData = stateAfterClick.computedRowData[rowId];
              const marker = rowData?.virtualFrames.find((f) => f.id === mId);
              return marker?.points?.some(
                (mp) =>
                  mp.id === gp.id &&
                  mp.namespaceId === gp.namespaceId &&
                  mp.instanceId === gp.instanceId &&
                  mp.trackId === gp.trackId,
              );
            }),
          );

          const allSelectableCovered = coveredPoints.length === globalSelectablePoints.length;

          const shouldGlobalAppearSelected = checkIfMarkerShouldAppearSelected(
            stateAfterClick,
            globalRowId,
            globalMarker.id,
          );

          console.log(`\nGlobal marker ${globalMarker.id}:`);
          console.log("  Total points:", globalMarker.points?.length);
          console.log("  Selectable points:", globalSelectablePoints.length);
          console.log("  Covered selectable points:", coveredPoints.length);
          console.log("  All selectable covered:", allSelectableCovered);
          console.log("  Should appear selected:", shouldGlobalAppearSelected);

          // A global marker should only appear selected if ALL its selectable points are covered
          expect(shouldGlobalAppearSelected).toBe(allSelectableCovered);

          if (allSelectableCovered) {
            foundFullyCoveredGlobal = true;
          }
        }
      }

      expect(foundMatchingGlobal).toBe(true);
      // We expect at least one global marker to be fully covered (the one with just our point)
      expect(foundFullyCoveredGlobal).toBe(true);
    }
  });
  it("should handle scale marker selection without selecting unrelated global markers", async () => {
    const state = store.getState();

    // Setup: Get the scale track marker s0 from alpha instance
    const trackRowId = `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${TRACK_IDS.SCALE}`;
    const trackMarkerId = "s0";

    const trackMarkerData = state.computedRowData[trackRowId]?.virtualFrames.find(
      (f) => f.id === trackMarkerId,
    );

    console.log("\n=== Scale Track Marker s0 ===");
    console.log("Track marker points:", trackMarkerData?.points);
    console.log("Track marker stamp:", trackMarkerData?.stamp);

    // Get ALL global markers to check which ones incorrectly show as selected
    const globalRowId = "global";
    const globalMarkers = state.computedRowData[globalRowId]?.virtualFrames || [];

    console.log("\n=== Global Markers Before Click ===");
    for (const globalMarker of globalMarkers) {
      const hasScalePoint = globalMarker.points?.some(
        (p) =>
          p.trackId === TRACK_IDS.SCALE &&
          p.id === trackMarkerId &&
          p.instanceId === INSTANCE_IDS.ALPHA_SHARED,
      );
      console.log(`Global marker ${globalMarker.id}:`, {
        pointCount: globalMarker.points?.length,
        hasTargetScalePoint: hasScalePoint,
        stamp: globalMarker.stamp,
      });
    }

    // Click the scale track marker
    const selectableTrackPoints =
      trackMarkerData?.points?.filter((p) => p.selectable !== false) || [];
    const trackPath = createMarkerPath(trackRowId, trackMarkerId);

    console.log("\n=== Clicking Scale Track Marker ===");
    console.log("Selectable points:", selectableTrackPoints);

    store.getState().clickMarker(selectableTrackPoints, trackPath, false, false);

    const stateAfterClick = store.getState();

    // Check what got selected
    console.log("\n=== Selection State After Click ===");
    console.log("Total selected paths:", stateAfterClick.selectionState.paths.length);
    console.log("Selected paths:", stateAfterClick.selectionState.paths);

    // The track marker itself should be selected
    expect(stateAfterClick.selectionState.pathSet.has(trackPath)).toBe(true);

    // Now check each global marker to see if it should appear selected
    const globalMarkersShowingAsSelected: string[] = [];
    const globalMarkersWithScaleS0: string[] = [];

    for (const globalMarker of globalMarkers) {
      // Check if this global marker contains the scale s0 point from alpha instance
      const hasScaleS0 = globalMarker.points?.some(
        (p) =>
          p.trackId === TRACK_IDS.SCALE &&
          p.id === "s0" &&
          p.instanceId === INSTANCE_IDS.ALPHA_SHARED &&
          p.selectable !== false,
      );

      if (hasScaleS0) {
        globalMarkersWithScaleS0.push(globalMarker.id);
      }

      const shouldAppearSelected = checkIfMarkerShouldAppearSelected(
        stateAfterClick,
        globalRowId,
        globalMarker.id,
      );

      if (shouldAppearSelected) {
        globalMarkersShowingAsSelected.push(globalMarker.id);
      }

      // Get selectable points for debugging
      const selectablePoints = globalMarker.points?.filter((p) => p.selectable !== false) || [];

      console.log(`\nGlobal marker ${globalMarker.id}:`, {
        hasScaleS0,
        shouldAppearSelected,
        isInSelection: stateAfterClick.selectionState.pathSet.has(
          createMarkerPath(globalRowId, globalMarker.id),
        ),
        totalPoints: globalMarker.points?.length || 0,
        selectablePointCount: selectablePoints.length,
        selectablePoints: selectablePoints.map((p) => ({
          id: p.id,
          trackId: p.trackId,
          instanceId: p.instanceId,
        })),
      });
    }

    console.log("\n=== Summary ===");
    console.log("Global markers containing scale s0:", globalMarkersWithScaleS0);
    console.log("Global markers showing as selected:", globalMarkersShowingAsSelected);

    // Only global markers that actually contain the scale s0 point should show as selected
    expect(globalMarkersShowingAsSelected.sort()).toEqual(globalMarkersWithScaleS0.sort());

    // Verify that we're not selecting too many global markers
    // The scale track starts at stamp 0.2, so there should be limited global markers affected
    expect(globalMarkersShowingAsSelected.length).toBeLessThanOrEqual(2);
  });

  it("should not show unrelated markers as selected when clicking different scale points", async () => {
    const state = store.getState();

    // Test with different scale markers to ensure the issue is consistent
    const trackRowId = `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${TRACK_IDS.SCALE}`;

    // Test scale marker s1 (stamp 0.4)
    const trackMarkerId = "s1";
    const trackMarkerData = state.computedRowData[trackRowId]?.virtualFrames.find(
      (f) => f.id === trackMarkerId,
    );

    const selectablePoints = trackMarkerData?.points?.filter((p) => p.selectable !== false) || [];
    const trackPath = createMarkerPath(trackRowId, trackMarkerId);

    console.log("\n=== Testing Scale Marker s1 ===");
    store.getState().clickMarker(selectablePoints, trackPath, false, false);

    const stateAfterClick = store.getState();

    // Check global markers
    const globalRowId = "global";
    const globalMarkers = state.computedRowData[globalRowId]?.virtualFrames || [];

    let incorrectlySelectedCount = 0;

    for (const globalMarker of globalMarkers) {
      const containsS1 = globalMarker.points?.some(
        (p) =>
          p.trackId === TRACK_IDS.SCALE &&
          p.id === "s1" &&
          p.instanceId === INSTANCE_IDS.ALPHA_SHARED &&
          p.selectable !== false,
      );

      const shouldAppearSelected = checkIfMarkerShouldAppearSelected(
        stateAfterClick,
        globalRowId,
        globalMarker.id,
      );

      if (shouldAppearSelected && !containsS1) {
        incorrectlySelectedCount++;
        const selectablePoints = globalMarker.points?.filter((p) => p.selectable !== false) || [];
        console.log(
          `ERROR: Global marker ${globalMarker.id} shows as selected but doesn't contain s1`,
        );
        console.log("  Total points:", globalMarker.points?.length || 0);
        console.log("  Selectable points count:", selectablePoints.length);
        console.log(
          "  Selectable points:",
          selectablePoints.map((p) => ({
            id: p.id,
            trackId: p.trackId,
            instanceId: p.instanceId,
          })),
        );
        console.log(
          "  All points:",
          globalMarker.points?.map((p) => ({
            id: p.id,
            trackId: p.trackId,
            instanceId: p.instanceId,
            selectable: p.selectable,
          })),
        );
      }
    }

    // No global markers should show as selected unless they contain the clicked point
    expect(incorrectlySelectedCount).toBe(0);
  });
});

/**
 * Helper function that mimics the isSelected logic from data-point.tsx
 * This checks if a marker should appear selected based only on its selectable points
 */
function checkIfMarkerShouldAppearSelected(
  state: any,
  sourceRowId: string,
  markerId: string,
): boolean {
  const computed = state.computedRowData[sourceRowId];
  const markerData = computed?.virtualFrames.find((f: any) => f.id === markerId);

  if (!markerData?.points || markerData.points.length === 0) {
    const markerPath = createMarkerPath(sourceRowId, markerId);
    return state.selectionState.pathSet.has(markerPath);
  }

  // Only check selectable points
  const selectablePoints = markerData.points.filter((p: any) => p.selectable !== false);

  // If there are no selectable points, the marker cannot be selected
  if (selectablePoints.length === 0) {
    return false;
  }

  for (const point of selectablePoints) {
    const pointPath = `${point.namespaceId}/${point.instanceId}/${point.trackId}`;

    let pointIsSelected = false;

    if (point.attribute) {
      const attrPath = `${pointPath}/${point.attribute}`;
      const attrMarkerPath = createMarkerPath(attrPath, point.id);

      if (state.selectionState.pathSet.has(attrMarkerPath)) {
        pointIsSelected = true;
      } else {
        for (const selectedPath of state.selectionState.pathSet) {
          if (selectedPath.startsWith(`${pointPath}#`)) {
            const [, selectedMarkerId] = selectedPath.split("#");
            const parentData = state.computedRowData[pointPath];
            const parentMarker = parentData?.virtualFrames.find(
              (f: any) => f.id === selectedMarkerId,
            );
            if (
              parentMarker?.points?.some(
                (p: any) =>
                  p.id === point.id &&
                  p.attribute === point.attribute &&
                  p.trackId === point.trackId,
              )
            ) {
              pointIsSelected = true;
              break;
            }
          }
        }
      }
    } else {
      const pointMarkerPath = createMarkerPath(pointPath, point.id);
      pointIsSelected = state.selectionState.pathSet.has(pointMarkerPath);
    }

    if (!pointIsSelected) {
      return false; // At least one selectable point is not selected
    }
  }

  return true; // All selectable points are selected
}
