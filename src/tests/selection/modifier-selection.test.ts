/**
 * Modifier Key Selection Tests
 * Exercises Ctrl/Cmd toggles and Shift range selection against the keypoint model.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createTestAnimationStore,
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

describe("Modifier Key Selection", () => {
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

  describe("Ctrl/Cmd Click (Toggle Selection)", () => {
    const opacityRow = `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${TRACK_IDS.OPACITY}`;

    it("adds markers to the selection and updates the reference", () => {
      const firstPoints = clickMarkerWith(store, opacityRow, "o0");
      let { selectionState } = store.getState();
      const expectedFirst = pointsToSignatures(firstPoints, selectionState.instanceId);

      expect(selectionSignatures(selectionState)).toEqual(expectedFirst);
      expect(selectionState.reference).toEqual({ rowId: opacityRow, markerId: "o0" });

      const secondPoints = clickMarkerWith(store, opacityRow, "o2", { mod: true });
      selectionState = store.getState().selectionState;
      const expectedSecond = pointsToSignatures(secondPoints, selectionState.instanceId);
      const expectedCombined = Array.from(new Set([...expectedFirst, ...expectedSecond])).sort();

      expect(selectionSignatures(selectionState)).toEqual(expectedCombined);
      expect(selectionState.reference).toEqual({ rowId: opacityRow, markerId: "o2" });
    });

    it("removes a marker when toggled again and clears the reference if it was the anchor", () => {
      clickMarkerWith(store, opacityRow, "o1");
      const initialSelection = store.getState().selectionState;
      expect(initialSelection.reference).toEqual({ rowId: opacityRow, markerId: "o1" });

      const points = getMarkerPoints(store, opacityRow, "o1");
      store.getState().clickMarker(points, opacityRow, "o1", false, true);

      const { selectionState } = store.getState();
      expect(selectionSignatures(selectionState)).toEqual([]);
      expect(selectionState.reference).toBeNull();
      expect(selectionState.instanceId).toBe(INSTANCE_IDS.ALPHA_SHARED);
    });

    it("supports toggling markers across different tracks within the same instance", () => {
      type MarkerDefinition =
        | { rowId: string; markerId: string }
        | { markerId: string; predicate: (rowId: string) => boolean };

      const definitions: MarkerDefinition[] = [
        { rowId: opacityRow, markerId: "o1" },
        {
          rowId: `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${TRACK_IDS.SCALE}`,
          markerId: "s1",
        },
        {
          markerId: "px2.x",
          predicate: (rowId: string) =>
            rowId.includes(`${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}`) &&
            rowId.includes(`${TRACK_IDS.POSITION}.x`),
        },
      ];

      const expectedSignatures = new Set<string>();

      definitions.forEach((definition, index) => {
        const markerContext =
          "rowId" in definition
            ? {
                rowId: definition.rowId,
                points: getMarkerPoints(store, definition.rowId, definition.markerId),
              }
            : findMarker(store, definition.markerId, definition.predicate);

        store
          .getState()
          .clickMarker(
            markerContext.points,
            markerContext.rowId,
            definition.markerId,
            false,
            index > 0,
          );

        const { selectionState } = store.getState();
        const markerSignatures = pointsToSignatures(
          markerContext.points,
          selectionState.instanceId,
        );
        markerSignatures.forEach((signature) => expectedSignatures.add(signature));
      });

      const { selectionState } = store.getState();
      expect(selectionState.instanceId).toBe(INSTANCE_IDS.ALPHA_SHARED);
      expect(selectionSignatures(selectionState)).toEqual(Array.from(expectedSignatures).sort());
    });
  });

  describe("Shift Click (Range Selection)", () => {
    const opacityRow = `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${TRACK_IDS.OPACITY}`;

    it("selects the range between the reference and the clicked marker", () => {
      clickMarkerWith(store, opacityRow, "o0");
      clickMarkerWith(store, opacityRow, "o2", { shift: true });

      const { selectionState } = store.getState();
      const range = collectRangeKeypoints(
        store.getState().derivedSnapshot?.rows?.[opacityRow]?.computed,
        selectionState.instanceId!,
        "o0",
        "o2",
      );

      expect(selectionSignatures(selectionState)).toEqual(keypointsToSignatures(range));
      expect(selectionState.reference).toEqual({ rowId: opacityRow, markerId: "o0" });
    });

    it("treats a shift click without an existing reference as a simple click", () => {
      const scaleRow = `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${TRACK_IDS.SCALE}`;
      const points = clickMarkerWith(store, scaleRow, "s1", { shift: true });

      const { selectionState } = store.getState();
      expect(selectionSignatures(selectionState)).toEqual(
        pointsToSignatures(points, selectionState.instanceId),
      );
      expect(selectionState.reference).toEqual({ rowId: scaleRow, markerId: "s1" });
    });

    it("falls back to a simple click when the clicked marker is in a different row", () => {
      const scaleRow = `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${TRACK_IDS.SCALE}`;
      clickMarkerWith(store, opacityRow, "o1");
      const points = clickMarkerWith(store, scaleRow, "s2", { shift: true });

      const { selectionState } = store.getState();
      expect(selectionSignatures(selectionState)).toEqual(
        pointsToSignatures(points, selectionState.instanceId),
      );
      expect(selectionState.reference).toEqual({ rowId: scaleRow, markerId: "s2" });
    });

    it("extends an existing range when shift and cmd/ctrl are combined", () => {
      clickMarkerWith(store, opacityRow, "o0");
      clickMarkerWith(store, opacityRow, "o2", { shift: true });
      const afterRange = store.getState().selectionState;
      const initialRange = selectionSignatures(afterRange);

      clickMarkerWith(store, opacityRow, "o3", { shift: true, mod: true });
      const { selectionState } = store.getState();
      const extendedRange = collectRangeKeypoints(
        store.getState().derivedSnapshot?.rows?.[opacityRow]?.computed,
        selectionState.instanceId!,
        "o0",
        "o3",
      );

      expect(selectionSignatures(selectionState)).toEqual(
        Array.from(new Set([...initialRange, ...keypointsToSignatures(extendedRange)])).sort(),
      );
      expect(selectionState.reference).toEqual({ rowId: opacityRow, markerId: "o0" });
    });

    it("preserves earlier row selections when creating a new shift range", () => {
      const scaleRow = `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${TRACK_IDS.SCALE}`;

      clickMarkerWith(store, scaleRow, "s0");
      clickMarkerWith(store, scaleRow, "s3", { shift: true });

      const scaleSelection = store.getState().selectionState;
      const instanceId = scaleSelection.instanceId!;
      const scaleRange = collectRangeKeypoints(
        store.getState().derivedSnapshot?.rows?.[scaleRow]?.computed,
        instanceId,
        "s0",
        "s3",
      );

      clickMarkerWith(store, opacityRow, "o2", { mod: true });
      clickMarkerWith(store, opacityRow, "o1", { shift: true });

      const stateAfter = store.getState();
      const opacityRange = collectRangeKeypoints(
        stateAfter.derivedSnapshot?.rows?.[opacityRow]?.computed,
        stateAfter.selectionState.instanceId!,
        "o1",
        "o2",
      );

      const expected = Array.from(
        new Set([...keypointsToSignatures(scaleRange), ...keypointsToSignatures(opacityRange)]),
      ).sort();

      expect(selectionSignatures(stateAfter.selectionState)).toEqual(expected);
      expect(stateAfter.selectionState.reference).toEqual({ rowId: opacityRow, markerId: "o2" });
    });
  });
});
