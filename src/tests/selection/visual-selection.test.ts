import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { AnimationStore } from "../../store";
import type { MarkerPoint } from "../../types";
import { isMarkerSelected } from "../../functions/selection-state-manager";
import {
  createTestAnimationStore,
  NAMESPACE_IDS,
  INSTANCE_IDS,
  TRACK_IDS,
} from "../../test-fixtures/animation-store-factory";
import {
  clickMarkerWith,
  getMarkerFrame,
  getMarkerPoints,
  selectionSignatures,
} from "./selection-test-helpers";

const GLOBAL_ROW_ID = "global";

describe("Visual Selection", () => {
  let store: AnimationStore;
  let cleanup: (() => void) | undefined;

  beforeEach(async () => {
    store = createTestAnimationStore({
      includeNamespaceA: true,
      includeNamespaceB: true,
      activeInstance: INSTANCE_IDS.ALPHA_SHARED,
    });

    cleanup = store.getState().initAnimationSubscriptions();
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 10);
    });
  });

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  it("marks the global marker as selected when the corresponding track marker is clicked", () => {
    const trackRowId = `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${TRACK_IDS.OPACITY}`;
    clickMarkerWith(store, trackRowId, "o1");

    const { selectionState } = store.getState();
    const globalPoints = getMarkerPoints(store, GLOBAL_ROW_ID, "o1-o1");

    expect(selectionSignatures(selectionState)).toContain(`${TRACK_IDS.OPACITY}:o1`);
    expect(isMarkerSelected(selectionState, globalPoints)).toBe(true);

    const unrelatedFrame = store
      .getState()
      .derivedSnapshot?.rows?.[GLOBAL_ROW_ID]?.computed?.virtualFrames.find((frame) => {
        const includesAnchor = (frame.points ?? []).some((point) => {
          const matchesAnchor =
            point.trackId === TRACK_IDS.OPACITY &&
            point.instanceId === INSTANCE_IDS.ALPHA_SHARED &&
            point.id === "o1";
          const isSelectable = point.selectable ?? true;
          return matchesAnchor && isSelectable;
        });

        return !includesAnchor;
      });

    if (!unrelatedFrame) {
      throw new Error("Expected at least one unrelated global marker for comparison");
    }

    expect(isMarkerSelected(selectionState, (unrelatedFrame.points ?? []) as MarkerPoint[])).toBe(
      false,
    );
  });

  it("propagates selection from global marker clicks back to the originating track marker", () => {
    clickMarkerWith(store, GLOBAL_ROW_ID, "o1-o1");

    const { selectionState } = store.getState();
    const trackRowId = `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${TRACK_IDS.OPACITY}`;
    const trackPoints = getMarkerPoints(store, trackRowId, "o1");

    expect(isMarkerSelected(selectionState, trackPoints)).toBe(true);

    const scalePoints = getMarkerPoints(
      store,
      `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${TRACK_IDS.SCALE}`,
      "s0",
    );

    expect(isMarkerSelected(selectionState, scalePoints)).toBe(false);
  });

  it("ignores non-matching instance data when evaluating global marker selection", () => {
    const trackRowId = `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${TRACK_IDS.OPACITY}`;
    clickMarkerWith(store, trackRowId, "o1");

    const { selectionState } = store.getState();
    const globalFrame = getMarkerFrame(store, GLOBAL_ROW_ID, "o1-o1");

    const betaPoints = (globalFrame.points ?? []).filter(
      (point) => point.instanceId === INSTANCE_IDS.BETA_SHARED,
    ) as MarkerPoint[];

    expect(betaPoints.length).toBeGreaterThan(0);
    expect(isMarkerSelected(selectionState, betaPoints)).toBe(false);

    const allPoints = (globalFrame.points ?? []) as MarkerPoint[];
    expect(isMarkerSelected(selectionState, allPoints)).toBe(true);
  });
});
