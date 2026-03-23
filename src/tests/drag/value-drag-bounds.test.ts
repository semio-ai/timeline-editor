import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { TrackRender, VerticalAxis } from "../../types";
import type { AnimationStore } from "../../store";
import {
  createMinimalAnimationStore,
  TRACK_IDS,
} from "../../test-fixtures/animation-store-factory";
import { flushMicrotasks } from "../utils/flush-microtasks";

describe("value-driven drag bounds", () => {
  let store: AnimationStore;
  let cleanup: (() => void) | undefined;
  const viewId = "spline-view";

  beforeEach(async () => {
    store = createMinimalAnimationStore();
    cleanup = store.getState().initAnimationSubscriptions();

    store.getState().addView({
      id: viewId,
      trackRender: TrackRender.Spline,
      verticalAxis: VerticalAxis.Normalized,
    });

    await flushMicrotasks();
  });

  afterEach(() => {
    store.getState().cancelDrag();
    cleanup?.();
  });

  it("normalizes against literal row bounds instead of spline view padding", () => {
    const state = store.getState();
    const rowEntry = Object.entries(state.instancedTrackSources).find(([, row]) =>
      row.data.some((entry) => entry.trackId === TRACK_IDS.SCALE),
    );
    if (!rowEntry) {
      throw new Error("Row containing scale track not found");
    }

    const [rowId, sourceRow] = rowEntry;
    const row = state.derivedSnapshot?.rows?.[rowId]?.computed;
    if (!row) {
      throw new Error("Missing computed row data for value drag test");
    }

    const axisRange = row.verticalAxisByView?.[viewId];
    if (!axisRange) {
      throw new Error("Missing spline view axis range for value drag test");
    }

    expect(axisRange.min).toBeLessThan(row.verticalBounds.min);
    expect(axisRange.max).toBeGreaterThan(row.verticalBounds.max);

    const datum = sourceRow.data[0];
    const track = state.tracks[datum.trackId];
    if (!track) {
      throw new Error("Missing scale track for value drag test");
    }

    const anchorPoint = track.points.find((point) => Math.abs(point.stamp - 800) < 1e-3);
    if (!anchorPoint || typeof anchorPoint.value !== "number") {
      throw new Error("Missing anchor point for value drag test");
    }

    store.getState().startValueDrag({
      rowId,
      trackId: datum.trackId,
      namespaceId: datum.namespaceId,
      instanceId: datum.instanceId,
      worldStamp: anchorPoint.stamp,
    });

    const currentValue = anchorPoint.value + 1;

    store.getState().updateValueDrag({
      currentValue,
      modifiers: { alt: false, shift: false, meta: false },
    });

    const dragState = store.getState().dragState;
    if (!dragState) {
      throw new Error("Missing drag state after value drag update");
    }

    const literalRange = row.verticalBounds.max - row.verticalBounds.min;
    const expectedDelta = (currentValue - anchorPoint.value) / literalRange;
    expect(dragState.normalizedValueDelta).toBeCloseTo(expectedDelta);

    const paddedRange = axisRange.max - axisRange.min;
    const paddedDelta = (currentValue - anchorPoint.value) / paddedRange;
    expect(dragState.normalizedValueDelta).not.toBeCloseTo(paddedDelta);
  });
});
