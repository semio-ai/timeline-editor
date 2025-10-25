/**
 * Basic Selection Tests
 * Tests fundamental selection operations: single click, clear, instance switching.
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
import { flushMicrotasks } from "../utils/flush-microtasks";
import {
  clickMarkerWith,
  findMarker,
  pointsToSignatures,
  selectionSignatures,
} from "./selection-test-helpers";

describe("Basic Selection Operations", () => {
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

  describe("Single Click Selection", () => {
    it("selects the clicked marker and records it as the reference", () => {
      const rowId = `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${TRACK_IDS.OPACITY}`;
      const markerId = "o1";

      const points = clickMarkerWith(store, rowId, markerId);
      const { selectionState } = store.getState();

      expect(selectionSignatures(selectionState)).toEqual(
        pointsToSignatures(points, selectionState.instanceId),
      );
      expect(selectionState.reference).toEqual({ rowId, markerId });
    });

    it("replaces the selection when a different marker is clicked without modifiers", () => {
      const rowId = `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${TRACK_IDS.OPACITY}`;

      const first = clickMarkerWith(store, rowId, "o0");
      let { selectionState } = store.getState();
      expect(selectionSignatures(selectionState)).toEqual(
        pointsToSignatures(first, selectionState.instanceId),
      );

      const second = clickMarkerWith(store, rowId, "o2");
      selectionState = store.getState().selectionState;

      expect(selectionSignatures(selectionState)).toEqual(
        pointsToSignatures(second, selectionState.instanceId),
      );
      expect(selectionState.reference).toEqual({ rowId, markerId: "o2" });
    });

    it("selects all constituent keypoints when clicking a grouped marker", () => {
      const marker = findMarker(
        store,
        "px0",
        (rowId) =>
          rowId.includes(`${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}`) &&
          rowId.includes(TRACK_IDS.POSITION),
      );

      store.getState().clickMarker(marker.points, marker.rowId, "px0");
      const { selectionState } = store.getState();

      expect(selectionSignatures(selectionState)).toEqual(
        pointsToSignatures(marker.points, selectionState.instanceId),
      );
    });
  });

  describe("Clear Selection", () => {
    it("removes all selected keypoints and the reference marker", () => {
      const rowId = `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${TRACK_IDS.OPACITY}`;

      clickMarkerWith(store, rowId, "o0");
      clickMarkerWith(store, rowId, "o2", { mod: true });

      store.getState().clearSelection();

      const { selectionState } = store.getState();
      expect(selectionSignatures(selectionState)).toEqual([]);
      expect(selectionState.reference).toBeNull();
    });
  });

  describe("Instance Switching", () => {
    it("ignores clicks from other instances when they are background-only", () => {
      const alphaRow = `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${TRACK_IDS.OPACITY}`;
      const betaRow = `${NAMESPACE_IDS.BETA}/${INSTANCE_IDS.BETA_SHARED}/${TRACK_IDS.OPACITY}`;

      const alphaPoints = clickMarkerWith(store, alphaRow, "o1");
      let { selectionState } = store.getState();

      expect(selectionState.instanceId).toBe(INSTANCE_IDS.ALPHA_SHARED);
      expect(selectionSignatures(selectionState)).toEqual(
        pointsToSignatures(alphaPoints, selectionState.instanceId),
      );

      const betaPoints = clickMarkerWith(store, betaRow, "o1");
      expect(betaPoints.length).toBe(0);
      selectionState = store.getState().selectionState;

      expect(selectionState.instanceId).toBe(INSTANCE_IDS.ALPHA_SHARED);
      expect(selectionSignatures(selectionState)).toEqual([]);
      expect(selectionState.reference).toBeNull();
    });

    it("keeps the current instance when clicking within the same instance", () => {
      const rowId = `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${TRACK_IDS.OPACITY}`;
      clickMarkerWith(store, rowId, "o0");

      const firstInstance = store.getState().selectionState.instanceId;
      clickMarkerWith(store, rowId, "o2");

      expect(store.getState().selectionState.instanceId).toBe(firstInstance);
    });
  });

  describe("Minimal Store", () => {
    it("supports selection in the minimal animation store", async () => {
      const minimalStore = createMinimalAnimationStore();
      const minimalCleanup = minimalStore.getState().initAnimationSubscriptions();
      // Flush microtasks so subscriptions settle without relying on timers
      await flushMicrotasks();

      const rowId = `default/main/${TRACK_IDS.SCALE}`;
      const points = clickMarkerWith(minimalStore, rowId, "s0");

      const { selectionState } = minimalStore.getState();
      expect(selectionSignatures(selectionState)).toEqual(
        pointsToSignatures(points, selectionState.instanceId),
      );
      expect(selectionState.reference).toEqual({ rowId, markerId: "s0" });

      minimalCleanup?.();
    });
  });
});
