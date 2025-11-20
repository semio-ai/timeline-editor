/**
 * Click Marker Action Tests
 * Verifies the click marker action using the keypoint-driven selection model.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createTestAnimationStore,
  createMinimalAnimationStore,
  NAMESPACE_IDS,
  INSTANCE_IDS,
  TRACK_IDS,
} from "../../test-fixtures/animation-store-factory";
import type { AnimationStore } from "../../store";
import { collectRangeKeypoints } from "../../functions/selection-state-manager";
import { flushMicrotasks } from "../utils/flush-microtasks";
import {
  clickMarkerWith,
  findMarker,
  getMarkerPoints,
  keypointsToSignatures,
  pointsToSignatures,
  selectionSignatures,
} from "./selection-test-helpers";

describe("Click Marker Action with Complete Store", () => {
  let store: AnimationStore;
  let cleanup: (() => void) | undefined;

  beforeEach(async () => {
    store = createTestAnimationStore({
      includeNamespaceA: true,
      includeNamespaceB: true,
      activeInstance: INSTANCE_IDS.ALPHA_SHARED,
    });

    cleanup = store.getState().initAnimationSubscriptions();
    // Flush microtasks so subscriptions settle without relying on timers
    await flushMicrotasks();
  });

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  describe("Click Action Fundamentals", () => {
    it("replaces the selection and updates the reference on a plain click", () => {
      const trackRowId = `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${TRACK_IDS.OPACITY}`;
      const markerId = "o1";

      const points = clickMarkerWith(store, trackRowId, markerId);
      const { selectionState } = store.getState();

      expect(selectionState.instanceId).toBe(INSTANCE_IDS.ALPHA_SHARED);
      expect(selectionState.reference).toEqual({ rowId: trackRowId, markerId });
      expect(selectionSignatures(selectionState)).toEqual(
        pointsToSignatures(points, selectionState.instanceId),
      );
    });

    it("clears selection when no selectable points are provided", () => {
      const trackRowId = `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${TRACK_IDS.SCALE}`;
      const markerId = "s1";

      const initialSelection = store.getState().selectionState;
      expect(initialSelection.keypoints.size).toBe(0);

      // Seed a selection so we can verify it clears.
      clickMarkerWith(store, trackRowId, markerId);
      expect(store.getState().selectionState.keypoints.size).toBeGreaterThan(0);

      store.getState().clickMarker([], trackRowId, "non-existent");
      const nextSelection = store.getState().selectionState;

      expect(selectionSignatures(nextSelection)).toEqual([]);
      expect(nextSelection.reference).toBeNull();
      expect(nextSelection.instanceId).toBe(initialSelection.instanceId);
    });

    it("creates new selection objects when the selection changes", () => {
      const originalSelection = store.getState().selectionState;
      const originalMap = originalSelection.keypoints;

      const trackRowId = `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${TRACK_IDS.SCALE}`;
      clickMarkerWith(store, trackRowId, "s1");

      const updatedSelection = store.getState().selectionState;
      expect(updatedSelection).not.toBe(originalSelection);
      expect(updatedSelection.keypoints).not.toBe(originalMap);
    });
  });

  describe("Modifier selection behavior", () => {
    const trackRowId = `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${TRACK_IDS.OPACITY}`;

    it("ctrl/cmd-click toggles markers and updates the reference when adding", () => {
      const firstPoints = clickMarkerWith(store, trackRowId, "o0");

      let { selectionState } = store.getState();
      const expectedFirst = pointsToSignatures(firstPoints, selectionState.instanceId);
      expect(selectionSignatures(selectionState)).toEqual(expectedFirst);
      expect(selectionState.reference).toEqual({ rowId: trackRowId, markerId: "o0" });

      const secondPoints = clickMarkerWith(store, trackRowId, "o2", { mod: true });
      selectionState = store.getState().selectionState;
      const expectedSecond = pointsToSignatures(secondPoints, selectionState.instanceId);
      const expectedCombined = Array.from(new Set([...expectedFirst, ...expectedSecond])).sort();

      expect(selectionSignatures(selectionState)).toEqual(expectedCombined);
      expect(selectionState.reference).toEqual({ rowId: trackRowId, markerId: "o2" });
    });

    it("ctrl/cmd-click retains the previous reference when toggling a non-reference marker off", () => {
      const firstPoints = clickMarkerWith(store, trackRowId, "o0");
      const firstSelection = store.getState().selectionState;
      const expectedFirst = pointsToSignatures(firstPoints, firstSelection.instanceId);
      expect(selectionSignatures(firstSelection)).toEqual(expectedFirst);

      const secondPoints = clickMarkerWith(store, trackRowId, "o2", { mod: true });
      const afterAdd = store.getState().selectionState;
      const expectedSecond = pointsToSignatures(secondPoints, afterAdd.instanceId);
      const expectedCombined = Array.from(new Set([...expectedFirst, ...expectedSecond])).sort();
      expect(selectionSignatures(afterAdd)).toEqual(expectedCombined);
      expect(afterAdd.reference).toEqual({ rowId: trackRowId, markerId: "o2" });

      const removePoints = getMarkerPoints(store, trackRowId, "o0");
      store.getState().clickMarker(removePoints, trackRowId, "o0", false, true);

      const { selectionState } = store.getState();
      expect(selectionSignatures(selectionState)).toEqual(expectedSecond);
      expect(selectionState.reference).toEqual({ rowId: trackRowId, markerId: "o2" });
    });

    it("clears the reference when ctrl/cmd-click toggles off the current reference marker", () => {
      clickMarkerWith(store, trackRowId, "o1");
      const initial = store.getState().selectionState;
      expect(initial.reference).toEqual({ rowId: trackRowId, markerId: "o1" });

      const points = getMarkerPoints(store, trackRowId, "o1");
      store.getState().clickMarker(points, trackRowId, "o1", false, true);

      const { selectionState } = store.getState();
      expect(selectionSignatures(selectionState)).toEqual([]);
      expect(selectionState.reference).toBeNull();
      expect(selectionState.instanceId).toBe(INSTANCE_IDS.ALPHA_SHARED);
    });
  });

  describe("Shift selection behavior", () => {
    it("selects a contiguous range within a row without moving the reference", () => {
      const trackRowId = `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${TRACK_IDS.OPACITY}`;
      clickMarkerWith(store, trackRowId, "o0");
      const referenceSelection = store.getState().selectionState;
      expect(referenceSelection.reference).toEqual({ rowId: trackRowId, markerId: "o0" });

      clickMarkerWith(store, trackRowId, "o2", { shift: true });
      const { selectionState } = store.getState();

      const rangeAddresses = collectRangeKeypoints(
        store.getState().derivedSnapshot?.rows?.[trackRowId]?.computed,
        selectionState.instanceId!,
        "o0",
        "o2",
      );

      expect(selectionSignatures(selectionState)).toEqual(keypointsToSignatures(rangeAddresses));
      expect(selectionState.reference).toEqual({ rowId: trackRowId, markerId: "o0" });
    });

    it("treats shift-click in a different row as a plain click", () => {
      const opacityRowId = `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${TRACK_IDS.OPACITY}`;
      const scaleRowId = `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${TRACK_IDS.SCALE}`;

      clickMarkerWith(store, opacityRowId, "o1");
      const firstSelection = store.getState().selectionState;
      expect(firstSelection.reference).toEqual({ rowId: opacityRowId, markerId: "o1" });

      const points = clickMarkerWith(store, scaleRowId, "s2", { shift: true });
      const { selectionState } = store.getState();

      expect(selectionSignatures(selectionState)).toEqual(
        pointsToSignatures(points, selectionState.instanceId),
      );
      expect(selectionState.reference).toEqual({ rowId: scaleRowId, markerId: "s2" });
    });
  });

  describe("Instance and namespace handling", () => {
    it("keeps the active instance when selecting background-only namespaces", () => {
      const betaRow = `${NAMESPACE_IDS.BETA}/${INSTANCE_IDS.BETA_SHARED}/${TRACK_IDS.OPACITY}`;

      expect(store.getState().selectionState.instanceId).toBe(INSTANCE_IDS.ALPHA_SHARED);

      const betaPoints = clickMarkerWith(store, betaRow, "o1");
      const { selectionState } = store.getState();

      expect(betaPoints.length).toBe(0);
      expect(selectionState.instanceId).toBe(INSTANCE_IDS.ALPHA_SHARED);
      expect(selectionSignatures(selectionState)).toEqual([]);
      expect(selectionState.reference).toBeNull();
    });
  });

  describe("Track type coverage", () => {
    it("selects all vector components in a group track marker", () => {
      const markerId = "px1.x";
      const marker = findMarker(
        store,
        markerId,
        (rowId) =>
          rowId.includes(`${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}`) &&
          rowId.includes(`${TRACK_IDS.POSITION}.x`),
      );

      store.getState().clickMarker(marker.points, marker.rowId, markerId);
      const { selectionState } = store.getState();

      expect(selectionSignatures(selectionState)).toEqual(
        pointsToSignatures(marker.points, selectionState.instanceId),
      );
    });

    it("handles euler rotation tracks", () => {
      const markerId = "rx0.r";
      const marker = findMarker(
        store,
        markerId,
        (rowId) =>
          rowId.includes(`${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_EXCLUSIVE}`) &&
          rowId.includes(`${TRACK_IDS.ROTATION}.r`),
      );

      store.getState().clickMarker(marker.points, marker.rowId, markerId);
      const { selectionState } = store.getState();

      expect(selectionSignatures(selectionState)).toEqual(
        pointsToSignatures(marker.points, selectionState.instanceId),
      );
    });
  });

  describe("Minimal store configuration", () => {
    it("supports marker selection in the minimal store", async () => {
      const minimalStore = createMinimalAnimationStore();
      const minimalCleanup = minimalStore.getState().initAnimationSubscriptions();
      // Flush microtasks so subscriptions settle without relying on timers
      await flushMicrotasks();

      const rowId = `default/main/${TRACK_IDS.SCALE}`;
      const markerId = "s0";

      const points = clickMarkerWith(minimalStore, rowId, markerId);
      const { selectionState } = minimalStore.getState();

      expect(selectionSignatures(selectionState)).toEqual(
        pointsToSignatures(points, selectionState.instanceId),
      );
      expect(selectionState.reference).toEqual({ rowId, markerId });

      minimalCleanup?.();
    });
  });
});
