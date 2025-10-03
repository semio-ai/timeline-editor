/**
 * Test file to reproduce and analyze the selection issue where clicking a marker
 * in the timeline (global view) doesn't select equivalent markers in track views
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  createTestAnimationStore,
  NAMESPACE_IDS,
  INSTANCE_IDS,
  TRACK_IDS,
} from "../test-fixtures/animation-store-factory";
import type { AnimationStore } from "../store";
import {
  createMarkerPath,
  parseMarkerPath,
  isMarkerSelected,
  getSelectionUnit,
} from "../functions/selection-state-manager";

describe("Selection Issue: Timeline vs Track Marker Selection", () => {
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

    // Wait for subscriptions to initialize (they use setTimeout)
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Verify computed data is available
    const state = store.getState();
    if (Object.keys(state.computedRowData).length === 0) {
      console.warn("Warning: computedRowData is still empty after initialization");
    }
  });

  it("should select equivalent markers in tracks when clicking a global timeline marker", async () => {
    const state = store.getState();

    // Log initial state
    console.log("\n=== Initial State ===");
    console.log("Active instance:", state.activeAnimationInstance);
    console.log("Computed row data keys:", Object.keys(state.computedRowData));

    // Find the global timeline marker with ID "o1-o1" (opacity marker at stamp 0.15)
    const globalRowId = "global";
    const globalMarkerId = "o1-o1";

    // Get the global marker data
    const globalMarkerData = state.computedRowData[globalRowId]?.virtualFrames.find(
      (f) => f.id === globalMarkerId,
    );

    console.log("\n=== Global Marker Data ===");
    console.log("Global marker ID:", globalMarkerId);
    console.log("Global marker stamp:", globalMarkerData?.stamp);
    console.log("Global marker points count:", globalMarkerData?.points?.length);
    console.log(
      "Global marker points:",
      JSON.stringify(
        globalMarkerData?.points?.map((p) => ({
          id: p.id,
          namespaceId: p.namespaceId,
          instanceId: p.instanceId,
          trackId: p.trackId,
          value: p.value,
          selectable: p.selectable,
        })),
        null,
        2,
      ),
    );

    // The global marker should have 2 points (one from each namespace)
    expect(globalMarkerData?.points?.length).toBe(2);

    // Find equivalent track markers that should be selected
    const trackRowId = `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${TRACK_IDS.OPACITY}`;
    const trackMarkerId = "o1"; // The individual track marker

    const trackMarkerData = state.computedRowData[trackRowId]?.virtualFrames.find(
      (f) => f.id === trackMarkerId,
    );

    console.log("\n=== Track Marker Data ===");
    console.log("Track row ID:", trackRowId);
    console.log("Track marker ID:", trackMarkerId);
    console.log("Track marker stamp:", trackMarkerData?.stamp);
    console.log(
      "Track marker points:",
      JSON.stringify(
        trackMarkerData?.points?.map((p) => ({
          id: p.id,
          namespaceId: p.namespaceId,
          instanceId: p.instanceId,
          trackId: p.trackId,
          value: p.value,
        })),
        null,
        2,
      ),
    );

    // The track marker should have 1 point
    expect(trackMarkerData?.points?.length).toBe(1);

    // Verify both markers share the same point data
    const sharedPoint = trackMarkerData?.points?.[0];
    const matchingGlobalPoint = globalMarkerData?.points?.find(
      (p) =>
        p.id === sharedPoint?.id &&
        p.namespaceId === sharedPoint?.namespaceId &&
        p.instanceId === sharedPoint?.instanceId &&
        p.trackId === sharedPoint?.trackId,
    );

    console.log("\n=== Point Matching ===");
    console.log("Shared point found in global marker:", !!matchingGlobalPoint);
    expect(matchingGlobalPoint).toBeDefined();

    // Now simulate clicking the global marker
    console.log("\n=== Simulating Click on Global Marker ===");
    // Filter for selectable points
    const selectableGlobalPoints = globalMarkerData?.points?.filter((p) => p.selectable) || [];
    const globalPath = createMarkerPath(globalRowId, globalMarkerId);
    store.getState().clickMarker(selectableGlobalPoints, globalPath, false, false);

    const stateAfterClick = store.getState();

    // Check the selection state
    console.log("\n=== Selection State After Click ===");
    console.log("Selected paths count:", stateAfterClick.selectionState.paths.length);
    console.log("Selected paths:", stateAfterClick.selectionState.paths);
    console.log("Reference marker:", stateAfterClick.selectionState.referenceMarker);

    // Check if the global marker is selected
    const globalMarkerPath = createMarkerPath(globalRowId, globalMarkerId);
    const isGlobalSelected = stateAfterClick.selectionState.pathSet.has(globalMarkerPath);
    console.log("\nGlobal marker selected:", isGlobalSelected);

    // Check if the track marker is selected
    const trackMarkerPath = createMarkerPath(trackRowId, trackMarkerId);
    const isTrackSelected = stateAfterClick.selectionState.pathSet.has(trackMarkerPath);
    console.log("Track marker selected:", isTrackSelected);

    // This is the key assertion - both should be selected!
    expect(isGlobalSelected).toBe(true);
    expect(isTrackSelected).toBe(true);

    // Additional check: verify the selection unit logic
    console.log("\n=== Selection Unit Analysis ===");
    const selectionUnit = stateAfterClick.selectionState.paths;
    console.log("Selection unit contains global marker:", selectionUnit.includes(globalMarkerPath));
    console.log("Selection unit contains track marker:", selectionUnit.includes(trackMarkerPath));

    // Both markers should be in the selection unit since they share data points
    expect(selectionUnit).toContain(globalMarkerPath);
    expect(selectionUnit).toContain(trackMarkerPath);
  });

  it("should select equivalent global marker when clicking a track marker", async () => {
    const state = store.getState();

    // Click on a track marker
    const trackRowId = `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${TRACK_IDS.OPACITY}`;
    const trackMarkerId = "o1";

    console.log("\n=== Clicking Track Marker ===");
    console.log("Track row ID:", trackRowId);
    console.log("Track marker ID:", trackMarkerId);

    // Get the track marker data and filter for selectable points
    const trackMarkerData = state.computedRowData[trackRowId]?.virtualFrames.find(
      (f) => f.id === trackMarkerId,
    );
    const selectableTrackPoints =
      trackMarkerData?.points?.filter((p) => p.selectable !== false) || [];
    const trackPath = createMarkerPath(trackRowId, trackMarkerId);
    store.getState().clickMarker(selectableTrackPoints, trackPath, false, false);

    const stateAfterClick = store.getState();

    // Check if both track and global markers are selected
    const trackMarkerPath = createMarkerPath(trackRowId, trackMarkerId);
    const globalMarkerPath = createMarkerPath("global", "o1-o1");

    console.log("\n=== Selection After Track Click ===");
    console.log("Selected paths:", stateAfterClick.selectionState.paths);
    console.log(
      "Track marker selected:",
      stateAfterClick.selectionState.pathSet.has(trackMarkerPath),
    );
    console.log(
      "Global marker selected:",
      stateAfterClick.selectionState.pathSet.has(globalMarkerPath),
    );

    // Both should be selected
    expect(stateAfterClick.selectionState.pathSet.has(trackMarkerPath)).toBe(true);
    expect(stateAfterClick.selectionState.pathSet.has(globalMarkerPath)).toBe(true);
  });

  it("should analyze the getSelectionUnit behavior for debugging", async () => {
    const state = store.getState();

    // Test with global marker
    console.log("\n=== Testing getSelectionUnit with Global Marker ===");
    const globalUnit = getSelectionUnit(state, "global", "o1-o1");
    console.log("Global marker selection unit:", globalUnit);
    console.log("Unit size:", globalUnit.length);

    // Test with track marker
    const trackRowId = `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${TRACK_IDS.OPACITY}`;
    console.log("\n=== Testing getSelectionUnit with Track Marker ===");
    const trackUnit = getSelectionUnit(state, trackRowId, "o1");
    console.log("Track marker selection unit:", trackUnit);
    console.log("Unit size:", trackUnit.length);

    // Analyze the difference
    console.log("\n=== Comparing Selection Units ===");
    const globalPaths = new Set(globalUnit);
    const trackPaths = new Set(trackUnit);

    const inGlobalNotTrack = [...globalPaths].filter((p) => !trackPaths.has(p));
    const inTrackNotGlobal = [...trackPaths].filter((p) => !globalPaths.has(p));
    const inBoth = [...globalPaths].filter((p) => trackPaths.has(p));

    console.log("Paths in global but not track:", inGlobalNotTrack);
    console.log("Paths in track but not global:", inTrackNotGlobal);
    console.log("Paths in both:", inBoth);

    // They should have significant overlap
    expect(inBoth.length).toBeGreaterThan(0);
  });

  it("should correctly handle multi-instance selection", async () => {
    const state = store.getState();

    // Get markers from both instances
    const alphaTrackRowId = `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${TRACK_IDS.OPACITY}`;
    const betaTrackRowId = `${NAMESPACE_IDS.BETA}/${INSTANCE_IDS.BETA_SHARED}/${TRACK_IDS.OPACITY}`;

    console.log("\n=== Multi-Instance Selection Test ===");
    console.log("Alpha track row:", alphaTrackRowId);
    console.log("Beta track row:", betaTrackRowId);

    // Click on alpha instance marker
    const alphaMarkerData = state.computedRowData[alphaTrackRowId]?.virtualFrames.find(
      (f) => f.id === "o1",
    );
    const selectableAlphaPoints =
      alphaMarkerData?.points?.filter((p) => p.selectable !== false) || [];
    const alphaPath = createMarkerPath(alphaTrackRowId, "o1");
    store.getState().clickMarker(selectableAlphaPoints, alphaPath, false, false);

    let currentState = store.getState();
    console.log("\nAfter clicking alpha marker:");
    console.log("Active instance:", currentState.activeAnimationInstance);
    console.log("Selected paths:", currentState.selectionState.paths);

    // The selection should be limited to alpha instance
    const alphaInstancePaths = currentState.selectionState.paths.filter((path) => {
      const parsed = parseMarkerPath(path);
      return parsed.instanceId === INSTANCE_IDS.ALPHA_SHARED;
    });

    console.log("Alpha instance paths:", alphaInstancePaths);
    expect(alphaInstancePaths.length).toBeGreaterThan(0);

    // Now click on beta instance marker (should switch instances)
    const betaMarkerData = state.computedRowData[betaTrackRowId]?.virtualFrames.find(
      (f) => f.id === "o1",
    );
    const selectableBetaPoints =
      betaMarkerData?.points?.filter((p) => p.selectable !== false) || [];
    const betaPath = createMarkerPath(betaTrackRowId, "o1");
    store.getState().clickMarker(selectableBetaPoints, betaPath, false, false);

    currentState = store.getState();
    console.log("\nAfter clicking beta marker:");
    console.log("Active instance:", currentState.activeAnimationInstance);
    console.log("Selected paths:", currentState.selectionState.paths);

    // Should have switched to beta instance
    expect(currentState.activeAnimationInstance).toBe(INSTANCE_IDS.BETA_SHARED);

    // Selection should now be in beta instance
    const betaInstancePaths = currentState.selectionState.paths.filter((path) => {
      const parsed = parseMarkerPath(path);
      return parsed.instanceId === INSTANCE_IDS.BETA_SHARED;
    });

    console.log("Beta instance paths:", betaInstancePaths);
    expect(betaInstancePaths.length).toBeGreaterThan(0);
  });

  it("should identify the root cause of the selection issue", async () => {
    console.log("\n=== ROOT CAUSE ANALYSIS ===");

    const state = store.getState();

    // Get the actual marker data to understand the structure
    const globalRowId = "global";
    const globalMarkerId = "o1-o1";
    const trackRowId = `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${TRACK_IDS.OPACITY}`;
    const trackMarkerId = "o1";

    const globalMarker = state.computedRowData[globalRowId]?.virtualFrames.find(
      (f) => f.id === globalMarkerId,
    );
    const trackMarker = state.computedRowData[trackRowId]?.virtualFrames.find(
      (f) => f.id === trackMarkerId,
    );

    console.log("\n1. MARKER STRUCTURE COMPARISON:");
    console.log(
      "Global marker points structure:",
      JSON.stringify(
        globalMarker?.points?.map((p) => ({
          id: p.id,
          namespaceId: p.namespaceId,
          instanceId: p.instanceId,
          trackId: p.trackId,
          selectable: p.selectable,
        })),
        null,
        2,
      ),
    );

    console.log(
      "\nTrack marker points structure:",
      JSON.stringify(
        trackMarker?.points?.map((p) => ({
          id: p.id,
          namespaceId: p.namespaceId,
          instanceId: p.instanceId,
          trackId: p.trackId,
          selectable: p.selectable,
        })),
        null,
        2,
      ),
    );

    console.log("\n2. POINT KEY GENERATION:");
    const getPointKey = (point: any) => {
      return `${point.namespaceId}/${point.instanceId}/${point.trackId}/${point.attribute || ""}#${point.id}`;
    };

    console.log(
      "Global marker point keys:",
      globalMarker?.points?.map((p) => getPointKey(p)),
    );
    console.log(
      "Track marker point keys:",
      trackMarker?.points?.map((p) => getPointKey(p)),
    );

    console.log("\n3. SELECTION UNIT LOGIC:");
    console.log("The issue is likely in getSelectionUnit function:");
    console.log("- It creates point keys and tries to match them across markers");
    console.log("- But the matching logic may not properly handle:");
    console.log("  * Markers with different numbers of points");
    console.log("  * The selectable flag differences");
    console.log("  * Instance filtering in the selection unit creation");

    console.log("\n4. PROPOSED FIX:");
    console.log("The getSelectionUnit function should:");
    console.log(
      "1. When clicking a multi-point marker (global), find ALL markers that contain ANY of those points",
    );
    console.log(
      "2. When clicking a single-point marker (track), find ALL markers that contain that point",
    );
    console.log(
      "3. Ensure the matching is bidirectional - global↔track markers recognize each other",
    );
    console.log("4. Consider the selectable flag when determining what to include");

    // Verify the actual behavior
    const globalUnit = getSelectionUnit(state, globalRowId, globalMarkerId);
    const trackUnit = getSelectionUnit(state, trackRowId, trackMarkerId);

    console.log("\n5. ACTUAL BEHAVIOR:");
    console.log("Global click unit:", globalUnit);
    console.log("Track click unit:", trackUnit);
    console.log("\nThe units should be equivalent or at least overlapping!");

    // The fix would be to update the getSelectionUnit logic to properly match
    // markers that share points, regardless of whether they have all the same points
  });
});
