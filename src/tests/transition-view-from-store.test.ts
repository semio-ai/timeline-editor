import { describe, expect, it, afterEach, beforeEach } from "vitest";
import { createTestAnimationStore, TRACK_IDS } from "../test-fixtures/animation-store-factory";
import { TrackRender } from "../types";
import { buildDerivedSnapshot } from "../functions";
import { flushMicrotasks } from "./utils/flush-microtasks";

describe("transition view params from store data", () => {
  const widthStartId = "w0";
  const widthEndId = "w1";
  let store: ReturnType<typeof createTestAnimationStore>;
  let cleanup: (() => void) | undefined;

  beforeEach(async () => {
    store = createTestAnimationStore({ includeNamespaceB: false });
    cleanup = store.getState().initAnimationSubscriptions();
    await flushMicrotasks(3);
  });

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  it("emits curved transition params (normalized) for width segment w0→w1", () => {
    const state = store.getState();
    const derived = buildDerivedSnapshot({
      tracks: state.tracks,
      namespaces: state.namespaces,
      animations: state.animations,
      animatables: state.animatables,
      instancedTrackSources: state.instancedTrackSources,
      dragState: state.dragState,
      selectionState: state.selectionState,
    });

    const widthRowEntry = Object.values(derived.rows).find((row) =>
      row.trackKeys?.some((key) => key.endsWith(`/${TRACK_IDS.WIDTH}`)),
    );
    if (!widthRowEntry) {
      throw new Error(`Row not found; rows: ${Object.keys(derived.rows).join(",")}`);
    }
    const row = widthRowEntry.computed;

    const segment = row?.interpolations.find(
      (seg) => seg.start.id === widthStartId && seg.end.id === widthEndId,
    );
    expect(segment).toBeTruthy();
    if (!segment?.start.points?.length || !segment?.end.points?.length) {
      throw new Error(
        `Segment lacks points: start=${JSON.stringify(segment?.start)}, end=${JSON.stringify(segment?.end)}`,
      );
    }

    const params = segment?.geometry?.effective?.renderParams?.[TrackRender.Transition];
    expect(params).toBeTruthy();

    // In transition view, x is stamp space, y normalized 0→1.
    expect(params?.start).toEqual({ x: 0, y: 0 });
    expect(params?.end).toEqual({ x: 0.3, y: 1 });
    expect(params?.cp1.x ?? 0).toBeCloseTo(0.135, 3);
    expect(params?.cp2.x ?? 0).toBeCloseTo(0.105, 3);
    expect(params?.cp1.y ?? 0).toBeCloseTo(0.15, 2);
    expect(params?.cp2.y ?? 0).toBeCloseTo(0.85, 2);
  });
});
