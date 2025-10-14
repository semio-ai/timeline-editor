/**
 * Click Marker Action Tests
 * Tests the click marker action with complete store instance
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  createTestAnimationStore,
  createMinimalAnimationStore,
  NAMESPACE_IDS,
  INSTANCE_IDS,
  TRACK_IDS,
  ANIMATABLE_IDS,
} from "../../test-fixtures/animation-store-factory";
import type { AnimationStore } from "../../store";
import { createMarkerPath, parseMarkerPath } from "../../functions/selection-state-manager";

describe("Click Marker Action with Complete Store", () => {
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

  describe("Click Action Fundamentals", () => {
    it("should execute clickMarker action through store", () => {
      const state = store.getState();
      const trackRowId = `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${TRACK_IDS.OPACITY}`;
      const markerId = "o1";

      // Find the marker data
      const markerData = state.computedRowData[trackRowId]?.virtualFrames.find(
        (f) => f.id === markerId,
      );

      expect(markerData).toBeDefined();
      const selectablePoints = markerData?.points?.filter((p) => p.selectable) || [];
      const path = createMarkerPath(trackRowId, markerId);

      // Execute click action
      store.getState().clickMarker(selectablePoints, path, false, false);

      // Verify selection state was updated
      const newState = store.getState();
      expect(newState.selectionState.paths).toContain(path);
      expect(newState.selectionState.referenceMarker).toBe(path);
    });

    it("should handle click on non-existent marker gracefully", () => {
      const trackRowId = `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${TRACK_IDS.OPACITY}`;
      const nonExistentPath = createMarkerPath(trackRowId, "non-existent");

      // Click with empty points array
      store.getState().clickMarker([], nonExistentPath, false, false);

      // Should not crash, selection should be empty or unchanged
      const newState = store.getState();
      expect(newState.selectionState).toBeDefined();
    });

    it("should update selection state immutably", () => {
      const originalState = store.getState();
      const originalSelectionState = originalState.selectionState;

      const trackRowId = `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${TRACK_IDS.SCALE}`;
      const markerId = "s1";
      const markerData = originalState.computedRowData[trackRowId]?.virtualFrames.find(
        (f) => f.id === markerId,
      );
      const path = createMarkerPath(trackRowId, markerId);

      store
        .getState()
        .clickMarker(markerData?.points?.filter((p) => p.selectable) || [], path, false, false);

      const newState = store.getState();

      // Selection state should be a new object
      expect(newState.selectionState).not.toBe(originalSelectionState);
      expect(newState.selectionState.paths).toContain(path);
    });
  });

  describe("Selection State Integration", () => {
    it("should properly integrate with selection state manager", () => {
      const state = store.getState();

      // Select multiple markers to test state management
      const markers = [
        {
          rowId: `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${TRACK_IDS.OPACITY}`,
          id: "o0",
        },
        {
          rowId: `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${TRACK_IDS.OPACITY}`,
          id: "o1",
        },
        {
          rowId: `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${TRACK_IDS.SCALE}`,
          id: "s1",
        },
      ];

      markers.forEach((marker, index) => {
        const markerData = state.computedRowData[marker.rowId]?.virtualFrames.find(
          (f) => f.id === marker.id,
        );
        const path = createMarkerPath(marker.rowId, marker.id);

        store.getState().clickMarker(
          markerData?.points?.filter((p) => p.selectable) || [],
          path,
          false,
          index > 0, // Use Ctrl for all but first
        );
      });

      const finalState = store.getState();

      // All markers should be selected
      expect(finalState.selectionState.paths.length).toBe(3);

      // PathSet should be in sync
      expect(finalState.selectionState.pathSet.size).toBe(3);
    });

    it("should maintain selection state consistency across operations", () => {
      const state = store.getState();

      // Perform a series of selection operations
      const trackRowId = `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${TRACK_IDS.POSITION}`;

      // Select first marker
      const marker1 = state.computedRowData[trackRowId]?.virtualFrames.find((f) => f.id === "px0");
      const path1 = createMarkerPath(trackRowId, "px0");
      store
        .getState()
        .clickMarker(marker1?.points?.filter((p) => p.selectable) || [], path1, false, false);

      let currentState = store.getState();
      const selectionCount1 = currentState.selectionState.paths.length;

      // Add second marker with Ctrl
      const marker2 = state.computedRowData[trackRowId]?.virtualFrames.find((f) => f.id === "px2");
      const path2 = createMarkerPath(trackRowId, "px2");
      store
        .getState()
        .clickMarker(marker2?.points?.filter((p) => p.selectable) || [], path2, false, true);

      currentState = store.getState();
      const selectionCount2 = currentState.selectionState.paths.length;

      // Selection should have grown
      expect(selectionCount2).toBeGreaterThan(selectionCount1);

      // Clear selection
      store.getState().clearSelection();

      currentState = store.getState();
      expect(currentState.selectionState.paths.length).toBe(0);
      expect(currentState.selectionState.pathSet.size).toBe(0);
      expect(currentState.selectionState.referenceMarker).toBeNull();
    });
  });

  describe("Track Type Specific Behavior", () => {
    it("should handle vector3 track selection", () => {
      const state = store.getState();
      const trackRowId = `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${TRACK_IDS.POSITION}`;
      const markerId = "px1";

      const markerData = state.computedRowData[trackRowId]?.virtualFrames.find(
        (f) => f.id === markerId,
      );

      expect(markerData).toBeDefined();
      expect(markerData?.points).toBeDefined();

      // Vector3 might have multiple points (x, y, z)
      const selectablePoints = markerData?.points?.filter((p) => p.selectable) || [];
      const path = createMarkerPath(trackRowId, markerId);

      store.getState().clickMarker(selectablePoints, path, false, false);

      const newState = store.getState();
      expect(newState.selectionState.paths).toContain(path);
    });

    it("should handle euler rotation track selection", () => {
      const state = store.getState();
      const trackRowId = `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_EXCLUSIVE}/${TRACK_IDS.ROTATION}`;
      const markerId = "rx0";

      const markerData = state.computedRowData[trackRowId]?.virtualFrames.find(
        (f) => f.id === markerId,
      );

      if (markerData) {
        const selectablePoints = markerData.points?.filter((p) => p.selectable) || [];
        const path = createMarkerPath(trackRowId, markerId);

        store.getState().clickMarker(selectablePoints, path, false, false);

        const newState = store.getState();
        expect(newState.selectionState.paths).toContain(path);
      }
    });

    it("should handle simple numeric track selection", () => {
      const state = store.getState();
      const trackRowId = `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${TRACK_IDS.SCALE}`;
      const markerId = "s1";

      const markerData = state.computedRowData[trackRowId]?.virtualFrames.find(
        (f) => f.id === markerId,
      );

      expect(markerData).toBeDefined();
      const selectablePoints = markerData?.points?.filter((p) => p.selectable) || [];
      const path = createMarkerPath(trackRowId, markerId);

      store.getState().clickMarker(selectablePoints, path, false, false);

      const newState = store.getState();
      expect(newState.selectionState.paths).toContain(path);
    });
  });

  describe("Instance and Namespace Handling", () => {
    it("should handle selection across different namespaces", () => {
      const state = store.getState();

      // Select from ALPHA namespace
      const alphaTrackRowId = `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${TRACK_IDS.OPACITY}`;
      const alphaMarkerId = "o1";
      const alphaMarkerData = state.computedRowData[alphaTrackRowId]?.virtualFrames.find(
        (f) => f.id === alphaMarkerId,
      );
      const alphaPath = createMarkerPath(alphaTrackRowId, alphaMarkerId);

      store
        .getState()
        .clickMarker(
          alphaMarkerData?.points?.filter((p) => p.selectable) || [],
          alphaPath,
          false,
          false,
        );

      // Verify ALPHA marker is selected
      expect(store.getState().selectionState.paths).toContain(alphaPath);

      // Try to select from BETA namespace (should switch instance)
      const betaTrackRowId = `${NAMESPACE_IDS.BETA}/${INSTANCE_IDS.BETA_SHARED}/${TRACK_IDS.OPACITY}`;
      const betaMarkerId = "o1";
      const betaMarkerData = state.computedRowData[betaTrackRowId]?.virtualFrames.find(
        (f) => f.id === betaMarkerId,
      );
      const betaPath = createMarkerPath(betaTrackRowId, betaMarkerId);

      store
        .getState()
        .clickMarker(
          betaMarkerData?.points?.filter((p) => p.selectable) || [],
          betaPath,
          false,
          false,
        );

      const finalState = store.getState();

      // Should have switched to BETA instance
      expect(finalState.activeAnimationInstance).toBe(INSTANCE_IDS.BETA_SHARED);

      // BETA marker should be selected, ALPHA should not
      expect(finalState.selectionState.paths).toContain(betaPath);
      expect(finalState.selectionState.paths).not.toContain(alphaPath);
    });

    it("should preserve instance when using Ctrl/Cmd within same instance", () => {
      const state = store.getState();
      const initialInstance = state.activeAnimationInstance;

      // Select multiple markers within same instance
      const trackRowId = `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${TRACK_IDS.OPACITY}`;

      const marker1 = state.computedRowData[trackRowId]?.virtualFrames.find((f) => f.id === "o0");
      const path1 = createMarkerPath(trackRowId, "o0");
      store
        .getState()
        .clickMarker(marker1?.points?.filter((p) => p.selectable) || [], path1, false, false);

      const marker2 = state.computedRowData[trackRowId]?.virtualFrames.find((f) => f.id === "o2");
      const path2 = createMarkerPath(trackRowId, "o2");
      store.getState().clickMarker(
        marker2?.points?.filter((p) => p.selectable) || [],
        path2,
        false,
        true, // Ctrl to add
      );

      // Instance should not have changed
      expect(store.getState().activeAnimationInstance).toBe(initialInstance);

      // Both markers should be selected
      const finalState = store.getState();
      expect(finalState.selectionState.paths).toContain(path1);
      expect(finalState.selectionState.paths).toContain(path2);
    });
  });

  describe("Minimal Store Configuration", () => {
    it("should work with minimal store configuration", async () => {
      const minimalStore = createMinimalAnimationStore();

      // Initialize subscriptions
      const cleanup = minimalStore.getState().initAnimationSubscriptions();
      await new Promise((resolve) => setTimeout(resolve, 10));

      const state = minimalStore.getState();

      // Find a marker in the minimal setup
      const trackRowId = `default/main/${TRACK_IDS.SCALE}`;
      const markerId = "s0";

      const markerData = state.computedRowData[trackRowId]?.virtualFrames.find(
        (f) => f.id === markerId,
      );

      expect(markerData).toBeDefined();

      const selectablePoints = markerData?.points?.filter((p) => p.selectable) || [];
      const path = createMarkerPath(trackRowId, markerId);

      // Click the marker
      minimalStore.getState().clickMarker(selectablePoints, path, false, false);

      // Verify selection
      const newState = minimalStore.getState();
      expect(newState.selectionState.paths).toContain(path);
      expect(newState.selectionState.referenceMarker).toBe(path);

      cleanup();
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("should handle empty points array", () => {
      const trackRowId = `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${TRACK_IDS.OPACITY}`;
      const path = createMarkerPath(trackRowId, "o1");

      // Click with empty points
      store.getState().clickMarker([], path, false, false);

      // Should not crash
      const state = store.getState();
      expect(state.selectionState).toBeDefined();
    });

    it("should handle invalid marker paths gracefully", () => {
      // Test with malformed path
      const invalidPath = "invalid/path/format";

      store.getState().clickMarker([], invalidPath, false, false);

      // Should not crash
      const state = store.getState();
      expect(state.selectionState).toBeDefined();
    });

    it("should handle rapid consecutive clicks", () => {
      const state = store.getState();
      const trackRowId = `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${TRACK_IDS.OPACITY}`;

      // Perform rapid clicks
      const markers = ["o0", "o1", "o2", "o3"];

      markers.forEach((markerId) => {
        const markerData = state.computedRowData[trackRowId]?.virtualFrames.find(
          (f) => f.id === markerId,
        );
        const path = createMarkerPath(trackRowId, markerId);

        store
          .getState()
          .clickMarker(markerData?.points?.filter((p) => p.selectable) || [], path, false, false);
      });

      // Should have the last clicked marker selected
      const finalState = store.getState();
      const lastPath = createMarkerPath(trackRowId, "o3");
      expect(finalState.selectionState.paths).toContain(lastPath);
      expect(finalState.selectionState.referenceMarker).toBe(lastPath);
    });
  });
});
