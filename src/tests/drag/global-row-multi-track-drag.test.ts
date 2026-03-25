import { describe, expect, it } from "vitest";
import { buildTrackKey } from "../../utils/track-key";
import {
  createTestAnimationStore,
  INSTANCE_IDS,
  NAMESPACE_IDS,
  TRACK_IDS,
} from "../../test-fixtures/animation-store-factory";
import { flushMicrotasks } from "../utils/flush-microtasks";
import { clickMarkerWith } from "../selection/selection-test-helpers";

describe("global row multi-track drag preview", () => {
  it("moves sibling track points added to the selection during drag", async () => {
    const store = createTestAnimationStore({
      includeNamespaceA: true,
      includeNamespaceB: false,
      activeInstance: INSTANCE_IDS.ALPHA_SHARED,
    });
    const cleanup = store.getState().initAnimationSubscriptions();
    await flushMicrotasks();

    store.setState((state) => ({
      tracks: {
        ...state.tracks,
        [TRACK_IDS.OPACITY]: {
          ...state.tracks[TRACK_IDS.OPACITY],
          points: [
            ...state.tracks[TRACK_IDS.OPACITY].points,
            { id: "o4", stamp: 800, value: 0.5 },
          ].toSorted((a, b) => a.stamp - b.stamp),
        },
      },
    }));
    await flushMicrotasks();

    const scaleRowId = buildTrackKey(
      NAMESPACE_IDS.ALPHA,
      INSTANCE_IDS.ALPHA_SHARED,
      TRACK_IDS.SCALE,
    );
    clickMarkerWith(store, scaleRowId, "s1");

    const globalRow = store.getState().derivedSnapshot?.rows?.global?.computed;
    if (!globalRow) {
      throw new Error("Missing global row for drag preview test");
    }

    const targetFrame = globalRow.virtualFrames.find((frame) =>
      frame.points.some((point) => point.trackId === TRACK_IDS.SCALE && point.id === "s1"),
    );
    if (!targetFrame) {
      throw new Error("Missing global frame containing scale point");
    }

    const siblingPoint = targetFrame.points.find((point) => point.trackId === TRACK_IDS.OPACITY);
    if (!siblingPoint) {
      throw new Error("Expected opacity point in shared global frame");
    }

    const expectedStamp = targetFrame.stamp + 200;

    store.getState().startDrag({
      axis: "horizontal",
      rowId: "global",
      markerId: targetFrame.id,
    });

    store.getState().updateDrag({
      normalizedStamp: { current: expectedStamp },
      modifiers: { alt: false, shift: false, meta: false },
    });

    await flushMicrotasks();

    const duringRow = store.getState().derivedSnapshot?.rows?.global?.computed;
    if (!duringRow) {
      throw new Error("Missing global row during drag preview");
    }

    const findStamp = (trackId: string, keypointId: string) =>
      duringRow.virtualFrames.find((frame) =>
        frame.points.some((point) => point.trackId === trackId && point.id === keypointId),
      )?.stamp;

    const scaleStamp = findStamp(TRACK_IDS.SCALE, "s1");
    const siblingStamp = findStamp(TRACK_IDS.OPACITY, siblingPoint.id);

    expect(scaleStamp).toBeCloseTo(expectedStamp, 6);
    expect(siblingStamp).toBeCloseTo(expectedStamp, 6);

    store.getState().cancelDrag();
    cleanup?.();
  });
});
