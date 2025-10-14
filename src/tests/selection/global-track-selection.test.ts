/**
 * Global vs Track Selection Tests
 * Tests the interaction between global timeline markers and individual track markers
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  createTestAnimationStore,
  NAMESPACE_IDS,
  INSTANCE_IDS,
  TRACK_IDS,
} from "../../test-fixtures/animation-store-factory";
import type { AnimationStore } from "../../store";
import {
  createMarkerPath,
  parseMarkerPath,
  getSelectionUnit,
} from "../../functions/selection-state-manager";

describe("Global vs Track Marker Selection", () => {
  let store: AnimationStore;

  beforeEach(async () => {
    store = createTestAnimationStore({
      includeNamespaceA: true,
      includeNamespaceB: true,
      activeInstance: INSTANCE_IDS.ALPHA_SHARED,
    });

    // Initialize subscriptions and wait for computed data
    const cleanup = store.getState().initAnimationSubscriptions();
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Cleanup after test
    return cleanup;
  });

  describe("Global Marker Selection", () => {
    it("should select equivalent track markers when clicking global timeline marker", () => {
      const state = store.getState();

      // Find a global marker that represents multiple track markers
      const globalRowId = "global";
      const globalMarkerId = "o1-o1"; // Opacity marker present in both namespaces

      const globalMarkerData = state.computedRowData[globalRowId]?.virtualFrames.find(
        (f) => f.id === globalMarkerId,
      );

      expect(globalMarkerData).toBeDefined();
      expect(globalMarkerData?.points?.length).toBeGreaterThan(0);

      // Click the global marker
      const selectablePoints = globalMarkerData?.points?.filter((p) => p.selectable) || [];
      const globalPath = createMarkerPath(globalRowId, globalMarkerId);
      store.getState().clickMarker(selectablePoints, globalPath, false, false);

      const newState = store.getState();

      // Check that the global marker is selected
      expect(newState.selectionState.paths).toContain(globalPath);

      // Check that corresponding track markers are also selected
      const trackRowIdAlpha = `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${TRACK_IDS.OPACITY}`;
      const trackMarkerPathAlpha = createMarkerPath(trackRowIdAlpha, "o1");

      // The selection should include both the global marker and the track marker
      expect(newState.selectionState.paths).toContain(trackMarkerPathAlpha);
    });

    it("should select global marker when clicking individual track marker", () => {
      const state = store.getState();

      // Click on an individual track marker
      const trackRowId = `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${TRACK_IDS.OPACITY}`;
      const trackMarkerId = "o1";

      const trackMarkerData = state.computedRowData[trackRowId]?.virtualFrames.find(
        (f) => f.id === trackMarkerId,
      );

      const selectablePoints = trackMarkerData?.points?.filter((p) => p.selectable) || [];
      const trackPath = createMarkerPath(trackRowId, trackMarkerId);
      store.getState().clickMarker(selectablePoints, trackPath, false, false);

      const newState = store.getState();

      // Check that the track marker is selected
      expect(newState.selectionState.paths).toContain(trackPath);

      // Check that the corresponding global marker is also selected
      const globalPath = createMarkerPath("global", "o1-o1");
      expect(newState.selectionState.paths).toContain(globalPath);
    });

    it("should handle markers that exist only in one namespace", () => {
      const state = store.getState();

      // Select a marker that only exists in namespace A (rotation)
      const trackRowId = `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_EXCLUSIVE}/${TRACK_IDS.ROTATION}`;
      const trackMarkerId = "rx0";

      const trackMarkerData = state.computedRowData[trackRowId]?.virtualFrames.find(
        (f) => f.id === trackMarkerId,
      );

      if (trackMarkerData) {
        const selectablePoints = trackMarkerData.points?.filter((p) => p.selectable) || [];
        const trackPath = createMarkerPath(trackRowId, trackMarkerId);
        store.getState().clickMarker(selectablePoints, trackPath, false, false);

        const newState = store.getState();

        // Should select the track marker
        expect(newState.selectionState.paths).toContain(trackPath);

        // Check if there's a corresponding global marker
        const globalMarkers = newState.selectionState.paths.filter(
          (path) => path.startsWith("global/")
        );

        // There might be a global marker if this point appears in the global timeline
        console.log("Track-specific marker selection - global markers found:", globalMarkers);
      }
    });
  });

  describe("Selection Unit Consistency", () => {
    it("should create consistent selection units for global and track markers", () => {
      const state = store.getState();

      // Test with a marker that exists in both namespaces
      const globalUnit = getSelectionUnit(state, "global", "o1-o1");
      const trackRowId = `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${TRACK_IDS.OPACITY}`;
      const trackUnit = getSelectionUnit(state, trackRowId, "o1");

      // Both units should contain overlapping paths
      const globalPaths = new Set(globalUnit);
      const trackPaths = new Set(trackUnit);

      const intersection = [...globalPaths].filter((p) => trackPaths.has(p));

      // Should have common elements
      expect(intersection.length).toBeGreaterThan(0);

      // Both should include the global marker
      expect(globalUnit).toContain("global/o1-o1");
      expect(trackUnit).toContain("global/o1-o1");

      // Both should include the track marker
      const trackMarkerPath = `${trackRowId}#o1`;
      expect(globalUnit).toContain(trackMarkerPath);
      expect(trackUnit).toContain(trackMarkerPath);
    });

    it("should handle multi-point markers correctly", () => {
      const state = store.getState();

      // Position markers have multiple points (x, y, z components)
      const groupTrackRowId = `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${TRACK_IDS.POSITION}`;
      const groupMarkerId = "px1";

      const groupMarkerData = state.computedRowData[groupTrackRowId]?.virtualFrames.find(
        (f) => f.id === groupMarkerId,
      );

      expect(groupMarkerData).toBeDefined();

      // Click the group marker
      const selectablePoints = groupMarkerData?.points?.filter((p) => p.selectable) || [];
      const groupPath = createMarkerPath(groupTrackRowId, groupMarkerId);
      store.getState().clickMarker(selectablePoints, groupPath, false, false);

      const newState = store.getState();

      // Should select the group marker
      expect(newState.selectionState.paths).toContain(groupPath);

      // Check for related global markers
      const globalMarkers = newState.selectionState.paths.filter(
        (path) => path.startsWith("global/")
      );

      console.log("Group marker selection - paths selected:", newState.selectionState.paths);
      console.log("Global markers included:", globalMarkers);
    });
  });

  describe("Cross-Instance Selection", () => {
    it("should only select markers from active instance when clicking global marker", () => {
      const state = store.getState();

      // Ensure we're in ALPHA_SHARED instance
      expect(state.activeAnimationInstance).toBe(INSTANCE_IDS.ALPHA_SHARED);

      // Click a global marker that exists in both instances
      const globalRowId = "global";
      const globalMarkerId = "o1-o1";

      const globalMarkerData = state.computedRowData[globalRowId]?.virtualFrames.find(
        (f) => f.id === globalMarkerId,
      );

      const selectablePoints = globalMarkerData?.points?.filter((p) => p.selectable) || [];
      const globalPath = createMarkerPath(globalRowId, globalMarkerId);
      store.getState().clickMarker(selectablePoints, globalPath, false, false);

      const newState = store.getState();

      // Check that only markers from the active instance are selected
      const selectedPaths = newState.selectionState.paths;

      // Filter for track markers (not global)
      const trackPaths = selectedPaths.filter((path) => !path.startsWith("global/"));

      trackPaths.forEach((path) => {
        const parsed = parseMarkerPath(path);
        if (parsed.instanceId) {
          // Should only be from ALPHA_SHARED instance
          expect(parsed.instanceId).toBe(INSTANCE_IDS.ALPHA_SHARED);
        }
      });

      // Should not include any BETA instance markers
      const betaPaths = trackPaths.filter((path) => {
        const parsed = parseMarkerPath(path);
        return parsed.instanceId === INSTANCE_IDS.BETA_SHARED;
      });

      expect(betaPaths).toEqual([]);
    });

    it("should switch instance when clicking marker from different instance", () => {
      const state = store.getState();

      // Start in ALPHA instance
      expect(state.activeAnimationInstance).toBe(INSTANCE_IDS.ALPHA_SHARED);

      // Click a marker from BETA instance
      const betaTrackRowId = `${NAMESPACE_IDS.BETA}/${INSTANCE_IDS.BETA_SHARED}/${TRACK_IDS.OPACITY}`;
      const betaMarkerId = "o1";

      const betaMarkerData = state.computedRowData[betaTrackRowId]?.virtualFrames.find(
        (f) => f.id === betaMarkerId,
      );

      if (betaMarkerData) {
        const selectablePoints = betaMarkerData.points?.filter((p) => p.selectable) || [];
        const betaPath = createMarkerPath(betaTrackRowId, betaMarkerId);
        store.getState().clickMarker(selectablePoints, betaPath, false, false);

        const newState = store.getState();

        // Should have switched to BETA instance
        expect(newState.activeAnimationInstance).toBe(INSTANCE_IDS.BETA_SHARED);

        // Selection should now be in BETA instance
        expect(newState.selectionState.paths).toContain(betaPath);

        // Should not contain any ALPHA instance markers
        const alphaPaths = newState.selectionState.paths.filter((path) => {
          const parsed = parseMarkerPath(path);
          return parsed.instanceId === INSTANCE_IDS.ALPHA_SHARED;
        });

        expect(alphaPaths).toEqual([]);
      }
    });
  });

  describe("Selectable vs Non-Selectable Points", () => {
    it("should only select markers with selectable points", () => {
      const state = store.getState();

      // Find markers and check their selectable status
      Object.entries(state.computedRowData).forEach(([rowId, rowData]) => {
        if (rowData?.virtualFrames) {
          rowData.virtualFrames.forEach((frame) => {
            const selectablePoints = frame.points?.filter((p) => p.selectable) || [];
            const nonSelectablePoints = frame.points?.filter((p) => !p.selectable) || [];

            if (selectablePoints.length > 0 && nonSelectablePoints.length > 0) {
              console.log(`Mixed selectable marker found: ${rowId}#${frame.id}`);
              console.log(`  Selectable: ${selectablePoints.length}, Non-selectable: ${nonSelectablePoints.length}`);
            }
          });
        }
      });
    });

    it("should filter out non-selectable points when clicking", () => {
      const state = store.getState();
      const trackRowId = `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${TRACK_IDS.SCALE}`;
      const markerId = "s1";

      const markerData = state.computedRowData[trackRowId]?.virtualFrames.find(
        (f) => f.id === markerId,
      );

      if (markerData) {
        // Get all points vs selectable points
        const allPoints = markerData.points || [];
        const selectablePoints = allPoints.filter((p) => p.selectable);

        console.log(`Marker ${markerId}: Total points: ${allPoints.length}, Selectable: ${selectablePoints.length}`);

        // Click with only selectable points
        const path = createMarkerPath(trackRowId, markerId);
        store.getState().clickMarker(selectablePoints, path, false, false);

        const newState = store.getState();

        // Marker should be selected
        expect(newState.selectionState.paths).toContain(path);

        // The selection should be based only on selectable points
        expect(newState.selectionState.paths.length).toBeGreaterThan(0);
      }
    });
  });

  describe("Visual Selection Appearance", () => {
    it("should correctly determine visual selection state for related markers", () => {
      const state = store.getState();

      // Select a track marker
      const trackRowId = `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${TRACK_IDS.OPACITY}`;
      const trackMarkerId = "o1";

      const trackMarkerData = state.computedRowData[trackRowId]?.virtualFrames.find(
        (f) => f.id === trackMarkerId,
      );

      const selectablePoints = trackMarkerData?.points?.filter((p) => p.selectable) || [];
      const trackPath = createMarkerPath(trackRowId, trackMarkerId);
      store.getState().clickMarker(selectablePoints, trackPath, false, false);

      const newState = store.getState();

      // Check visual selection state
      const isTrackSelected = newState.selectionState.pathSet.has(trackPath);
      const isGlobalSelected = newState.selectionState.pathSet.has("global/o1-o1");

      console.log("Visual selection check:");
      console.log(`  Track marker ${trackMarkerId}: ${isTrackSelected ? "SELECTED" : "NOT SELECTED"}`);
      console.log(`  Global marker o1-o1: ${isGlobalSelected ? "SELECTED" : "NOT SELECTED"}`);

      // Both should appear selected
      expect(isTrackSelected).toBe(true);
      expect(isGlobalSelected).toBe(true);
    });

    it("should handle partial selection in group tracks", () => {
      const state = store.getState();
      const groupTrackRowId = `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${TRACK_IDS.POSITION}`;

      // Select one marker from the group
      const markerId1 = "px0";
      const markerData1 = state.computedRowData[groupTrackRowId]?.virtualFrames.find(
        (f) => f.id === markerId1,
      );

      const selectablePoints1 = markerData1?.points?.filter((p) => p.selectable) || [];
      const path1 = createMarkerPath(groupTrackRowId, markerId1);
      store.getState().clickMarker(selectablePoints1, path1, false, false);

      let currentState = store.getState();

      // Add another marker from the same group with Ctrl
      const markerId2 = "px2";
      const markerData2 = currentState.computedRowData[groupTrackRowId]?.virtualFrames.find(
        (f) => f.id === markerId2,
      );

      const selectablePoints2 = markerData2?.points?.filter((p) => p.selectable) || [];
      const path2 = createMarkerPath(groupTrackRowId, markerId2);
      store.getState().clickMarker(selectablePoints2, path2, false, true);

      currentState = store.getState();

      // Both markers should be selected
      expect(currentState.selectionState.paths).toContain(path1);
      expect(currentState.selectionState.paths).toContain(path2);

      // Check for any related global markers
      const globalPaths = currentState.selectionState.paths.filter(
        (path) => path.startsWith("global/")
      );

      console.log("Partial group selection - global paths:", globalPaths);
    });
  });
});
