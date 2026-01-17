import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AnimationStore } from "../../store";
import {
  createTestAnimationStore,
  INSTANCE_IDS,
  NAMESPACE_IDS,
  TRACK_IDS,
} from "../../test-fixtures/animation-store-factory";
import { flushMicrotasks } from "../utils/flush-microtasks";
import { clickMarkerWith, resolveMarkerFrameId } from "../selection/selection-test-helpers";

describe("multi-selection drag anchoring", () => {
  let store: AnimationStore;
  let cleanup: (() => void) | undefined;

  beforeEach(async () => {
    store = createTestAnimationStore({
      includeNamespaceA: true,
      includeNamespaceB: false,
      activeInstance: INSTANCE_IDS.ALPHA_SHARED,
    });

    cleanup = store.getState().initAnimationSubscriptions();
    await flushMicrotasks();
  });

  afterEach(() => {
    store.getState().cancelDrag();
    cleanup?.();
  });

  it("anchors to the dragged marker within a multi-selection", () => {
    const rowId = `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${TRACK_IDS.SCALE}`;

    clickMarkerWith(store, rowId, "s0");
    clickMarkerWith(store, rowId, "s2", { mod: true });

    const frameId = resolveMarkerFrameId(store, rowId, "s2");

    store.getState().startDrag({
      axis: "horizontal",
      markerId: frameId,
      rowId,
    });

    const dragState = store.getState().dragState;
    if (!dragState) {
      throw new Error("Expected drag state after startDrag");
    }

    const track = store.getState().tracks[TRACK_IDS.SCALE];
    if (!track) {
      throw new Error("Missing scale track for drag anchor test");
    }

    const anchorPoint = track.points.find((point) => point.id === "s2");
    if (!anchorPoint) {
      throw new Error("Missing anchor keypoint for drag anchor test");
    }

    expect(dragState.anchor.keypointId).toBe("s2");
    expect(dragState.anchorFrameId).toBe(frameId);
    expect(dragState.stampOrigin).toBeCloseTo(anchorPoint.stamp);
  });
});
