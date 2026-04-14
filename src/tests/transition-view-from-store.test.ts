import { describe, expect, it, afterEach, beforeEach } from "vitest";
import { createTestAnimationStore, TRACK_IDS } from "../test-fixtures/animation-store-factory";
import { TrackRender } from "../types";
import { buildDerivedSnapshot, materializeSegmentSample } from "../functions";
import { flushMicrotasks } from "./utils/flush-microtasks";

describe("transition view params from store data", () => {
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

  it("emits normalized transition samples for the opacity segment o1→o2", () => {
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

    const opacityRowEntry = Object.entries(derived.rows)
      .filter(([id]) => !id.startsWith("entity:") && !id.startsWith("instance:"))
      .map(([, row]) => row)
      .find((row) => row.trackKeys?.some((key) => key.endsWith(`/${TRACK_IDS.OPACITY}`)));
    if (!opacityRowEntry) {
      throw new Error(`Row not found; rows: ${Object.keys(derived.rows).join(",")}`);
    }
    const row = opacityRowEntry.computed;

    const segment = row?.render?.segments?.find(
      (seg) =>
        seg.trackId === TRACK_IDS.OPACITY &&
        seg.startKeypointId === "o1" &&
        seg.endKeypointId === "o2",
    );
    expect(segment).toBeTruthy();
    const sample = segment?.samples?.[TrackRender.Transition];
    if (!segment || !sample) {
      throw new Error("Expected a transition sample for the opacity segment");
    }
    const resolved = materializeSegmentSample(sample, derived.renderSampleCache);
    if (!resolved) {
      throw new Error("Expected a resolved sample for the opacity segment");
    }

    const points = resolved.points;
    const stride = resolved.stride;
    const count = Math.floor(points.length / stride);
    if (count < 2) {
      throw new Error("Opacity segment sample is missing points");
    }

    const firstY = points[1];
    const lastY = points[(count - 1) * stride + 1];
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < count; i += 1) {
      const y = points[i * stride + 1];
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }

    // Transition samples are normalized 0→1 even when the value delta is zero.
    expect(firstY).toBeCloseTo(0, 6);
    expect(lastY).toBeCloseTo(1, 6);
    expect(maxY - minY).toBeGreaterThan(0.5);
  });
});
