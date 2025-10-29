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
  pointsToSignatures,
  selectionSignatures,
} from "./selection-test-helpers";

const GLOBAL_ROW_ID = "global";
const OPACITY_ROW_ID = `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${TRACK_IDS.OPACITY}`;

describe("Global vs Track Selection", () => {
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

  it("selects the same keypoints when clicking the global marker or its originating track marker", () => {
    const trackPoints = getMarkerPoints(store, OPACITY_ROW_ID, "o1");
    clickMarkerWith(store, GLOBAL_ROW_ID, "o1-o1");

    const { selectionState } = store.getState();
    const expected = pointsToSignatures(trackPoints, selectionState.instanceId);

    expect(selectionState.instanceId).toBe(INSTANCE_IDS.ALPHA_SHARED);
    expect(selectionSignatures(selectionState)).toEqual(expected);
    expect(isMarkerSelected(selectionState, trackPoints)).toBe(true);

    const globalPoints = getMarkerPoints(store, GLOBAL_ROW_ID, "o1-o1");
    expect(isMarkerSelected(selectionState, globalPoints)).toBe(true);
  });

  it("ignores non-selectable or cross-instance points when a global marker is clicked", () => {
    clickMarkerWith(store, GLOBAL_ROW_ID, "o1-o1");

    const { selectionState } = store.getState();
    expect(selectionState.instanceId).toBe(INSTANCE_IDS.ALPHA_SHARED);

    const globalFrame = getMarkerFrame(store, GLOBAL_ROW_ID, "o1-o1");
    const betaPoints = (globalFrame.points ?? []).filter(
      (point) => point.instanceId === INSTANCE_IDS.BETA_SHARED,
    ) as MarkerPoint[];

    expect(betaPoints.length).toBeGreaterThan(0);
    expect(isMarkerSelected(selectionState, betaPoints)).toBe(false);

    const allPoints = (globalFrame.points ?? []) as MarkerPoint[];
    expect(isMarkerSelected(selectionState, allPoints)).toBe(true);
  });

  it("selects the corresponding global marker when the track marker is clicked", () => {
    clickMarkerWith(store, OPACITY_ROW_ID, "o1");

    const { selectionState } = store.getState();
    const globalPoints = getMarkerPoints(store, GLOBAL_ROW_ID, "o1-o1");

    expect(isMarkerSelected(selectionState, globalPoints)).toBe(true);

    const unrelatedGlobal = store
      .getState()
      .computedRowData[GLOBAL_ROW_ID]?.virtualFrames.find((frame) => {
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

    if (!unrelatedGlobal) {
      throw new Error("Expected an unrelated global marker for comparison");
    }

    expect(isMarkerSelected(selectionState, (unrelatedGlobal.points ?? []) as MarkerPoint[])).toBe(
      false,
    );
  });
});
