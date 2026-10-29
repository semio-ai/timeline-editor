import { describe, expect, it } from "vitest";
import type { RawVector2 } from "@semio/data";
import {
  createTestAnimationStore,
  TRACK_IDS,
  NAMESPACE_IDS,
  INSTANCE_IDS,
} from "../../test-fixtures/animation-store-factory";
import { computeRowData, resolveRowTransform } from "../../functions/compute-row-data";
import {
  handlePointerDelta,
  handlesWithinSnapTolerance,
} from "../../functions/handle-pointer-delta";
import { TransitionPairing } from "../../types";

const instanceId = INSTANCE_IDS.ALPHA_SHARED;
const namespaceId = NAMESPACE_IDS.ALPHA;
const trackId = TRACK_IDS.OPACITY;

function setup(timescale: number) {
  const store = createTestAnimationStore({ includeNamespaceB: false });
  store.setState((state) => ({
    namespaces: {
      ...state.namespaces,
      [namespaceId]: {
        ...state.namespaces[namespaceId],
        animationInstances: {
          ...state.namespaces[namespaceId].animationInstances,
          [instanceId]: {
            ...state.namespaces[namespaceId].animationInstances[instanceId],
            settings: { active: true, offset: 37.25, timescale },
          },
        },
      },
    },
  }));
  store.getState().updateTrack({
    id: trackId,
    points: [
      { id: "before", stamp: 0, value: 0 },
      {
        id: "anchor",
        stamp: 1000,
        value: 1,
        transitions: {
          in: { x: -100, y: 0 },
          out: { x: 100, y: 0 },
          pairing: TransitionPairing.Free,
        },
      },
      { id: "after", stamp: 2000, value: 2 },
    ],
  });
  store.setState((state) => ({ selectionState: { ...state.selectionState, instanceId } }));
  const state = store.getState();
  const row = Object.values(state.instancedTrackSources).find(
    (candidate) =>
      candidate.data.length === 1 &&
      candidate.data[0].trackId === trackId &&
      candidate.data[0].instanceId === instanceId,
  )!;
  if (!row) throw new Error("Expected an opacity row");
  const context = { animations: state.animations, namespaces: state.namespaces };
  const transform = resolveRowTransform(row, context);
  return { store, row, transform };
}

describe("handle pointer round trip", () => {
  it.each([0.5, 1, 2])("stores local deltas and redraws under the pointer at %s×", (timescale) => {
    const { store, row, transform } = setup(timescale);
    const anchor = { x: 1000, y: 1 };
    const pointer = { x: (anchor.x + 170.123456789) / timescale + 37.25, y: 1.375 };
    const start = {
      side: "out" as const,
      rowId: row.id,
      trackId,
      keypointId: "anchor",
      neighborKeypointId: "after",
      startStamp: anchor.x,
      endStamp: 2000,
      startValue: anchor.y,
      endValue: 2,
      viewScaleX: transform.scaleX,
      viewScaleY: 1,
    };
    store.getState().startHandleDrag(start);
    expect(store.getState().dragState?.instanceTransform).toEqual({ offset: 37.25, timescale });
    const delta = handlePointerDelta({
      ...start,
      pointerXWorld: pointer.x,
      normalizedValueDelta: pointer.y - anchor.y,
      controlPoint: { x: anchor.x + 100, y: anchor.y },
      anchorStamp: anchor.x,
      anchorValue: anchor.y,
      xInverse: (world) => (world - transform.offsetX) / transform.scaleX,
    });
    store
      .getState()
      .updateHandleDrag({
        handleDeltas: { out: delta, pairing: TransitionPairing.Free },
        modifiers: { alt: false, shift: false, meta: false },
      });
    store.getState().commitDrag();
    const state = store.getState();
    const stored = state.tracks[trackId].points.find((point) => point.id === "anchor")!.transitions!
      .out as RawVector2;
    const worldDelta = pointer.x - (anchor.x * transform.scaleX + transform.offsetX);
    expect(Math.abs(stored.x - worldDelta * timescale)).toBeLessThan(1e-9);
    expect(stored.y).toBe(0.375);
    if (timescale === 1) expect(Math.abs(stored.x - worldDelta)).toBeLessThan(1e-9);
    const geometry = computeRowData(
      row,
      state.tracks,
      {},
      state.animatables,
      undefined,
      state.selectionState,
      { animations: state.animations, namespaces: state.namespaces },
    );
    const handle = geometry.render!.handles!.find(
      (candidate) => candidate.keypointId === "anchor" && candidate.side === "out",
    )!;
    const redrawn = { x: handle.world.x * transform.scaleX + transform.offsetX, y: handle.world.y };
    expect(Math.abs(redrawn.x - pointer.x)).toBeLessThan(1e-9);
    expect(Math.abs(redrawn.y - pointer.y)).toBeLessThan(1e-9);
  });

  it("judges the pairing angle on screen, both at drag start and pointer movement", () => {
    const { store, row } = setup(2);
    const inDelta = { x: -100, y: 0 };
    const outDelta = { x: 100, y: Math.tan((2 * Math.PI) / 180) * 100 };
    expect(handlesWithinSnapTolerance(inDelta, outDelta, 1, 1)).toBe(true);
    expect(handlesWithinSnapTolerance(inDelta, outDelta, 0.5, 1)).toBe(false);
    store
      .getState()
      .updateKeypoint(trackId, {
        id: "anchor",
        transitions: { in: inDelta, out: outDelta, pairing: undefined },
      });
    const basePairing = store
      .getState()
      .startHandleDrag({
        side: "out",
        rowId: row.id,
        trackId,
        keypointId: "anchor",
        neighborKeypointId: "after",
        startStamp: 1000,
        endStamp: 2000,
        startValue: 1,
        endValue: 2,
        viewScaleX: 0.5,
        viewScaleY: 1,
      });
    expect(store.getState().dragState?.handleAnchor?.basePairing).toBe(TransitionPairing.Free);
    expect(basePairing).toBe(TransitionPairing.Free);
    const delta = handlePointerDelta({
      side: "out",
      pointerXWorld: 37.25 + 1100 / 2,
      normalizedValueDelta: outDelta.y,
      controlPoint: { x: 1000, y: 1 },
      anchorStamp: 1000,
      anchorValue: 1,
      startStamp: 1000,
      endStamp: 2000,
      xInverse: (x) => (x - 37.25) * 2,
    });
    const withinSnapTolerance = handlesWithinSnapTolerance(delta, inDelta, 0.5, 1);
    store
      .getState()
      .updateHandleDrag({
        handleDeltas: { out: delta, withinSnapTolerance, pairing: basePairing },
        modifiers: { alt: false, shift: false, meta: false },
      });
    store.getState().commitDrag();
    expect(
      store.getState().tracks[trackId].points.find((point) => point.id === "anchor")!.transitions!
        .pairing,
    ).toBe(TransitionPairing.Free);
  });
});
