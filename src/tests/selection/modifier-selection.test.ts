/**
 * Modifier Key Selection Tests
 * Tests selection with modifier keys: Ctrl/Cmd for toggle, Shift for range
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
} from "../../functions/selection-state-manager";

describe("Modifier Key Selection", () => {
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

  describe("Ctrl/Cmd Click (Toggle Selection)", () => {
    it("should add to selection when marker not selected", () => {
      const state = store.getState();
      const trackRowId = `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${TRACK_IDS.OPACITY}`;

      // Select first marker
      const markerId1 = "o0";
      const markerData1 = state.computedRowData[trackRowId]?.virtualFrames.find(
        (f) => f.id === markerId1,
      );
      const path1 = createMarkerPath(trackRowId, markerId1);
      store.getState().clickMarker(
        markerData1?.points?.filter((p) => p.selectable) || [],
        path1,
        false,
        false,
      );

      // Verify first selection
      let currentState = store.getState();
      expect(currentState.selectionState.paths).toContain(path1);
      const initialSelectionCount = currentState.selectionState.paths.length;

      // Ctrl/Cmd click second marker to add to selection
      const markerId2 = "o2";
      const markerData2 = currentState.computedRowData[trackRowId]?.virtualFrames.find(
        (f) => f.id === markerId2,
      );
      const path2 = createMarkerPath(trackRowId, markerId2);
      store.getState().clickMarker(
        markerData2?.points?.filter((p) => p.selectable) || [],
        path2,
        false,
        true, // Ctrl/Cmd modifier
      );

      // Verify both are selected
      currentState = store.getState();
      expect(currentState.selectionState.paths).toContain(path1);
      expect(currentState.selectionState.paths).toContain(path2);
      expect(currentState.selectionState.paths.length).toBeGreaterThan(initialSelectionCount);
    });

    it("should remove from selection when marker already selected", () => {
      const state = store.getState();
      const trackRowId = `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${TRACK_IDS.OPACITY}`;

      // Select two markers
      const markerId1 = "o0";
      const markerData1 = state.computedRowData[trackRowId]?.virtualFrames.find(
        (f) => f.id === markerId1,
      );
      const path1 = createMarkerPath(trackRowId, markerId1);
      store.getState().clickMarker(
        markerData1?.points?.filter((p) => p.selectable) || [],
        path1,
        false,
        false,
      );

      const markerId2 = "o1";
      const markerData2 = state.computedRowData[trackRowId]?.virtualFrames.find(
        (f) => f.id === markerId2,
      );
      const path2 = createMarkerPath(trackRowId, markerId2);
      store.getState().clickMarker(
        markerData2?.points?.filter((p) => p.selectable) || [],
        path2,
        false,
        true, // Add to selection
      );

      // Verify both selected
      let currentState = store.getState();
      expect(currentState.selectionState.paths).toContain(path1);
      expect(currentState.selectionState.paths).toContain(path2);

      // Ctrl/Cmd click first marker again to deselect
      store.getState().clickMarker(
        markerData1?.points?.filter((p) => p.selectable) || [],
        path1,
        false,
        true, // Ctrl/Cmd to toggle off
      );

      // Verify only second marker remains selected
      currentState = store.getState();
      expect(currentState.selectionState.paths).not.toContain(path1);
      expect(currentState.selectionState.paths).toContain(path2);
    });

    it("should toggle entire group when clicking group track with Ctrl/Cmd", () => {
      const state = store.getState();
      const groupTrackRowId = `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${TRACK_IDS.POSITION}`;
      const simpleTrackRowId = `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${TRACK_IDS.SCALE}`;

      // First select a simple marker
      const simpleMarkerId = "s0";
      const simpleMarkerData = state.computedRowData[simpleTrackRowId]?.virtualFrames.find(
        (f) => f.id === simpleMarkerId,
      );
      const simplePath = createMarkerPath(simpleTrackRowId, simpleMarkerId);
      store.getState().clickMarker(
        simpleMarkerData?.points?.filter((p) => p.selectable) || [],
        simplePath,
        false,
        false,
      );

      // Ctrl/Cmd click a group marker to add entire group
      const groupMarkerId = "px1";
      const groupMarkerData = state.computedRowData[groupTrackRowId]?.virtualFrames.find(
        (f) => f.id === groupMarkerId,
      );
      const groupPath = createMarkerPath(groupTrackRowId, groupMarkerId);
      store.getState().clickMarker(
        groupMarkerData?.points?.filter((p) => p.selectable) || [],
        groupPath,
        false,
        true, // Ctrl/Cmd modifier
      );

      const currentState = store.getState();
      // Should contain both the simple marker and the group marker
      expect(currentState.selectionState.paths).toContain(simplePath);
      expect(currentState.selectionState.paths).toContain(groupPath);
      // Selection should have grown
      expect(currentState.selectionState.paths.length).toBeGreaterThan(1);
    });

    it("should handle Ctrl/Cmd click across different track types", () => {
      const state = store.getState();

      // Select from different track types
      const tracks = [
        { rowId: `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${TRACK_IDS.OPACITY}`, markerId: "o1" },
        { rowId: `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${TRACK_IDS.SCALE}`, markerId: "s1" },
        { rowId: `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${TRACK_IDS.POSITION}`, markerId: "px2" },
      ];

      const paths: string[] = [];

      tracks.forEach((track, index) => {
        const markerData = state.computedRowData[track.rowId]?.virtualFrames.find(
          (f) => f.id === track.markerId,
        );
        const path = createMarkerPath(track.rowId, track.markerId);
        paths.push(path);

        store.getState().clickMarker(
          markerData?.points?.filter((p) => p.selectable) || [],
          path,
          false,
          index > 0, // Use Ctrl/Cmd for all but the first
        );
      });

      // All should be selected
      const currentState = store.getState();
      paths.forEach((path) => {
        expect(currentState.selectionState.paths).toContain(path);
      });
    });
  });

  describe("Shift Click (Range Selection)", () => {
    it("should select range between reference and clicked marker", () => {
      const state = store.getState();
      const trackRowId = `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${TRACK_IDS.OPACITY}`;

      // Select first marker to establish reference
      const markerId1 = "o0";
      const markerData1 = state.computedRowData[trackRowId]?.virtualFrames.find(
        (f) => f.id === markerId1,
      );
      const path1 = createMarkerPath(trackRowId, markerId1);
      store.getState().clickMarker(
        markerData1?.points?.filter((p) => p.selectable) || [],
        path1,
        false,
        false,
      );

      // Shift-click third marker to select range
      const markerId3 = "o2";
      const markerData3 = state.computedRowData[trackRowId]?.virtualFrames.find(
        (f) => f.id === markerId3,
      );
      const path3 = createMarkerPath(trackRowId, markerId3);
      store.getState().clickMarker(
        markerData3?.points?.filter((p) => p.selectable) || [],
        path3,
        true, // Shift modifier
        false,
      );

      const currentState = store.getState();

      // Should include start and end markers
      expect(currentState.selectionState.paths).toContain(path1);
      expect(currentState.selectionState.paths).toContain(path3);

      // Should also include any markers between them (o1)
      const path2 = createMarkerPath(trackRowId, "o1");
      expect(currentState.selectionState.paths).toContain(path2);
    });

    it("should handle shift-click without reference marker", () => {
      const state = store.getState();
      const trackRowId = `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${TRACK_IDS.SCALE}`;

      // Shift-click without any prior selection (no reference)
      const markerId = "s1";
      const markerData = state.computedRowData[trackRowId]?.virtualFrames.find(
        (f) => f.id === markerId,
      );
      const path = createMarkerPath(trackRowId, markerId);
      store.getState().clickMarker(
        markerData?.points?.filter((p) => p.selectable) || [],
        path,
        true, // Shift modifier
        false,
      );

      const currentState = store.getState();

      // Should just select the clicked marker since no reference
      expect(currentState.selectionState.paths).toContain(path);
      expect(currentState.selectionState.referenceMarker).toBe(path);
    });

    it("should handle shift-click across different rows (should not range select)", () => {
      const state = store.getState();

      // Select marker in first track
      const trackRowId1 = `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${TRACK_IDS.OPACITY}`;
      const markerId1 = "o1";
      const markerData1 = state.computedRowData[trackRowId1]?.virtualFrames.find(
        (f) => f.id === markerId1,
      );
      const path1 = createMarkerPath(trackRowId1, markerId1);
      store.getState().clickMarker(
        markerData1?.points?.filter((p) => p.selectable) || [],
        path1,
        false,
        false,
      );

      // Shift-click marker in different track (different row)
      const trackRowId2 = `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${TRACK_IDS.SCALE}`;
      const markerId2 = "s1";
      const markerData2 = state.computedRowData[trackRowId2]?.virtualFrames.find(
        (f) => f.id === markerId2,
      );
      const path2 = createMarkerPath(trackRowId2, markerId2);
      store.getState().clickMarker(
        markerData2?.points?.filter((p) => p.selectable) || [],
        path2,
        true, // Shift modifier
        false,
      );

      const currentState = store.getState();

      // Should only select the newly clicked marker (no range across rows)
      expect(currentState.selectionState.paths).toContain(path2);
      expect(currentState.selectionState.paths).not.toContain(path1);
      expect(currentState.selectionState.referenceMarker).toBe(path2);
    });

    it("should select range in group tracks", () => {
      const state = store.getState();
      const groupTrackRowId = `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${TRACK_IDS.POSITION}`;

      // Select first position marker
      const markerId1 = "px0";
      const markerData1 = state.computedRowData[groupTrackRowId]?.virtualFrames.find(
        (f) => f.id === markerId1,
      );
      const path1 = createMarkerPath(groupTrackRowId, markerId1);
      store.getState().clickMarker(
        markerData1?.points?.filter((p) => p.selectable) || [],
        path1,
        false,
        false,
      );

      // Shift-click third position marker
      const markerId3 = "px2";
      const markerData3 = state.computedRowData[groupTrackRowId]?.virtualFrames.find(
        (f) => f.id === markerId3,
      );
      const path3 = createMarkerPath(groupTrackRowId, markerId3);
      store.getState().clickMarker(
        markerData3?.points?.filter((p) => p.selectable) || [],
        path3,
        true, // Shift modifier
        false,
      );

      const currentState = store.getState();

      // Should include start, end, and middle markers
      expect(currentState.selectionState.paths).toContain(path1);
      expect(currentState.selectionState.paths).toContain(path3);

      // Should also include px1 (the marker in between)
      const path2 = createMarkerPath(groupTrackRowId, "px1");
      expect(currentState.selectionState.paths).toContain(path2);
    });

    it("should update reference marker on shift-click", () => {
      const state = store.getState();
      const trackRowId = `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${TRACK_IDS.SCALE}`;

      // Select first marker
      const markerId1 = "s0";
      const markerData1 = state.computedRowData[trackRowId]?.virtualFrames.find(
        (f) => f.id === markerId1,
      );
      const path1 = createMarkerPath(trackRowId, markerId1);
      store.getState().clickMarker(
        markerData1?.points?.filter((p) => p.selectable) || [],
        path1,
        false,
        false,
      );

      // Reference should be the first marker
      expect(store.getState().selectionState.referenceMarker).toBe(path1);

      // Shift-click to select range
      const markerId3 = "s2";
      const markerData3 = state.computedRowData[trackRowId]?.virtualFrames.find(
        (f) => f.id === markerId3,
      );
      const path3 = createMarkerPath(trackRowId, markerId3);
      store.getState().clickMarker(
        markerData3?.points?.filter((p) => p.selectable) || [],
        path3,
        true,
        false,
      );

      // Reference should remain the first marker after range selection
      const currentState = store.getState();
      expect(currentState.selectionState.referenceMarker).toBe(path1);
    });
  });

  describe("Combined Modifiers", () => {
    it("should handle Shift+Ctrl/Cmd (extend range selection)", () => {
      const state = store.getState();
      const trackRowId = `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${TRACK_IDS.OPACITY}`;

      // Select first marker
      const markerId1 = "o0";
      const markerData1 = state.computedRowData[trackRowId]?.virtualFrames.find(
        (f) => f.id === markerId1,
      );
      const path1 = createMarkerPath(trackRowId, markerId1);
      store.getState().clickMarker(
        markerData1?.points?.filter((p) => p.selectable) || [],
        path1,
        false,
        false,
      );

      // Shift-click to select range to o2
      const markerId2 = "o2";
      const markerData2 = state.computedRowData[trackRowId]?.virtualFrames.find(
        (f) => f.id === markerId2,
      );
      const path2 = createMarkerPath(trackRowId, markerId2);
      store.getState().clickMarker(
        markerData2?.points?.filter((p) => p.selectable) || [],
        path2,
        true, // Shift
        false,
      );

      // Now Shift+Ctrl/Cmd click to extend range
      const markerId3 = "o3";
      const markerData3 = state.computedRowData[trackRowId]?.virtualFrames.find(
        (f) => f.id === markerId3,
      );
      const path3 = createMarkerPath(trackRowId, markerId3);
      store.getState().clickMarker(
        markerData3?.points?.filter((p) => p.selectable) || [],
        path3,
        true, // Shift
        true, // Ctrl/Cmd
      );

      const currentState = store.getState();

      // Should have all markers from o0 to o3
      expect(currentState.selectionState.paths).toContain(path1);
      expect(currentState.selectionState.paths).toContain(path2);
      expect(currentState.selectionState.paths).toContain(path3);
      expect(currentState.selectionState.paths).toContain(createMarkerPath(trackRowId, "o1"));
    });
  });
});
