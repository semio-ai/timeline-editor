import { describe, expect, it } from "vitest";
import { buildTrackKey } from "../../utils/track-key";
import {
  createTestAnimationStore,
  INSTANCE_IDS,
  NAMESPACE_IDS,
  TRACK_IDS,
} from "../../test-fixtures/animation-store-factory";
import { flushMicrotasks } from "../utils/flush-microtasks";
import { clickMarkerWith, resolveMarkerFrameId } from "../selection/selection-test-helpers";

describe("multi-track vertical drag bounds", () => {
  it("scales non-anchor tracks by their own bounds", async () => {
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
          points: state.tracks[TRACK_IDS.OPACITY].points.map((point) =>
            point.id === "o1" ? { ...point, value: 0.5 } : point,
          ),
        },
      },
    }));
    await flushMicrotasks();

    const positionRowId = buildTrackKey(
      NAMESPACE_IDS.ALPHA,
      INSTANCE_IDS.ALPHA_SHARED,
      TRACK_IDS.POSITION_X,
    );
    const opacityRowId = buildTrackKey(
      NAMESPACE_IDS.ALPHA,
      INSTANCE_IDS.ALPHA_SHARED,
      TRACK_IDS.OPACITY,
    );

    clickMarkerWith(store, positionRowId, "px2.x");
    clickMarkerWith(store, opacityRowId, "o1", { mod: true });

    const positionFrameId = resolveMarkerFrameId(store, positionRowId, "px2.x");
    store.getState().startDrag({
      axis: "vertical",
      rowId: positionRowId,
      markerId: positionFrameId,
    });

    store.getState().updateDrag({
      normalizedValueDelta: 0.1,
      modifiers: { alt: false, shift: false, meta: false },
    });
    await flushMicrotasks();

    const opacityRow = store.getState().derivedSnapshot?.rows?.[opacityRowId]?.computed;
    if (!opacityRow) {
      throw new Error("Missing opacity row during drag preview");
    }

    const opacityMarker = opacityRow.render?.markers?.find((marker) => marker.id === "o1");
    if (!opacityMarker) {
      throw new Error("Missing opacity marker during drag preview");
    }

    expect(opacityMarker.value).toBeCloseTo(0.6, 6);

    store.getState().cancelDrag();
    cleanup?.();
  });
});
