import { describe, it, expect } from "vitest";
import { createMinimalAnimationStore } from "../test-fixtures/animation-store-factory";
import { type AnimationData, TransitionDirective } from "../store-types";
import { StandardTransitionType } from "../types";
import { buildTrackKey } from "../utils/track-key";
import { computeWorldStamp } from "../functions/compute-instance-time";
import { inferAutoHandleDeltas } from "../functions/infer-auto-handles";
import { clipBaker } from "./module-clip/clip-baker";
import { flushMicrotasks } from "./utils/flush-microtasks";

/**
 * Helper: sample the current interpolator for a specific trackKey at given local times.
 * Returns undefined if no interpolator found.
 */
function sampleInterpolator(
  state: AnimationData,
  namespaceId: string,
  instanceId: string,
  trackId: string,
  samples: number[],
): number[] | undefined {
  const key = buildTrackKey(namespaceId, instanceId, trackId);
  const interp = state.derivedSnapshot?.tracks?.[key]?.canonical?.curve;
  if (!interp) return undefined;
  return samples.map((t) => {
    const v = interp(t);
    if (typeof v !== "number") {
      throw new Error("Expected numeric track for sampling tests");
    }
    return v;
  });
}

/**
 * Helper: resolve a single namespace and instance id from the store.
 * Uses the first namespace and its first instance.
 */
function resolveSingleNamespaceAndInstance(state: AnimationData): {
  namespaceId: string;
  instanceId: string;
  timescale: number;
  offset: number;
} {
  const namespaceId = Object.keys(state.namespaces)[0];
  const ns = state.namespaces[namespaceId];
  const instanceId = Object.keys(ns.animationInstances)[0];
  const inst = ns.animationInstances[instanceId];
  return {
    namespaceId,
    instanceId,
    timescale: inst.settings.timescale,
    offset: inst.settings.offset,
  };
}

/**
 * Helper: find a mid-segment local stamp on a numeric track.
 */
function findMidSegmentLocalStamp(
  state: AnimationData,
  trackId: string,
): { start: number; end: number; mid: number; startPointId: string; endPointId: string } {
  const pts = state.tracks[trackId].points.slice().sort((a, b) => a.stamp - b.stamp);
  if (pts.length < 2) {
    throw new Error("Track must have at least two points");
  }
  // Pick a segment with clear span; prefer the longest
  let bestIdx = 0;
  let bestSpan = -Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const span = pts[i + 1].stamp - pts[i].stamp;
    if (span > bestSpan) {
      bestSpan = span;
      bestIdx = i;
    }
  }
  const start = pts[bestIdx].stamp;
  const end = pts[bestIdx + 1].stamp;
  const mid = start + (end - start) * 0.5;
  return {
    start,
    end,
    mid,
    startPointId: pts[bestIdx].id,
    endPointId: pts[bestIdx + 1].id,
  };
}

describe("insertKeypointAtWorldStamp insertion preferences", () => {
  it("defaults to flat insertion and uses cubic transitions for the new keypoint", async () => {
    const store = createMinimalAnimationStore({ trackBaker: clipBaker });
    const state0 = store.getState();

    const trackId = Object.keys(state0.tracks)[0]; // minimal store has a single numeric track (SCALE)
    const { instanceId, timescale, offset } = resolveSingleNamespaceAndInstance(state0);
    const { mid: localMid, startPointId, endPointId } = findMidSegmentLocalStamp(state0, trackId);

    const startPointBefore = state0.tracks[trackId].points.find(
      (point) => point.id === startPointId,
    );
    const endPointBefore = state0.tracks[trackId].points.find((point) => point.id === endPointId);
    const startTransitionsBefore = JSON.parse(
      JSON.stringify(startPointBefore?.transitions ?? null),
    ) as unknown;
    const endTransitionsBefore = JSON.parse(
      JSON.stringify(endPointBefore?.transitions ?? null),
    ) as unknown;

    const worldStamp = computeWorldStamp(localMid, timescale, offset);

    store.getState().insertKeypointAtWorldStamp(trackId, worldStamp, instanceId);
    await flushMicrotasks();

    const state1 = store.getState();
    const inserted = state1.tracks[trackId].points.find((p) => Math.abs(p.stamp - localMid) < 1e-6);
    expect(inserted, "Expected a keypoint inserted at the local mid-segment time").toBeTruthy();
    expect(Math.abs(inserted!.stamp - localMid)).toBeLessThan(1e-9);
    expect(inserted?.transitions?.in).toBe(StandardTransitionType.Cubic);
    expect(inserted?.transitions?.out).toBe(StandardTransitionType.Cubic);

    const startPointAfter = state1.tracks[trackId].points.find(
      (point) => point.id === startPointId,
    );
    const endPointAfter = state1.tracks[trackId].points.find((point) => point.id === endPointId);
    expect(startPointAfter?.transitions ?? null).toEqual(startTransitionsBefore);
    expect(endPointAfter?.transitions ?? null).toEqual(endTransitionsBefore);
  });

  it("preserves curve shape around the insertion point when defaults request explicit handles", async () => {
    const store = createMinimalAnimationStore({ trackBaker: clipBaker });
    store.getState().setPreferences({
      newKeyDefaults: {
        transitions: {
          in: TransitionDirective.ExplicitHandles,
          out: TransitionDirective.ExplicitHandles,
        },
      },
    });
    const state0 = store.getState();
    const trackId = Object.keys(state0.tracks)[0]; // numeric track
    const { namespaceId, instanceId, timescale, offset } =
      resolveSingleNamespaceAndInstance(state0);

    // Identify a segment and build sample points inside (avoid endpoints to be robust)
    const { start, end, mid: localMid } = findMidSegmentLocalStamp(state0, trackId);
    const sampleCount = 9;
    const localSamples: number[] = Array.from({ length: sampleCount }, (_, i) => {
      const t = i / (sampleCount - 1); // [0..1]
      const s = start + (end - start) * t;
      // Avoid exact endpoints and exact insertion time to reduce numerical sensitivity in assertions
      if (Math.abs(s - localMid) < 1e-6) {
        return s + 1e-4 * (end - start);
      }
      if (i === 0) return s + 1e-4 * (end - start);
      if (i === sampleCount - 1) return s - 1e-4 * (end - start);
      return s;
    });

    // Pre-sample the interpolator
    const pre = sampleInterpolator(state0, namespaceId, instanceId, trackId, localSamples);
    expect(pre, "Expected pre-insertion interpolator").toBeTruthy();
    const preVals = pre!;

    // Insert at world mid time
    const worldMid = computeWorldStamp(localMid, timescale, offset);
    store.getState().insertKeypointAtWorldStamp(trackId, worldMid, instanceId);
    await flushMicrotasks();

    const state1 = store.getState();
    const post = sampleInterpolator(state1, namespaceId, instanceId, trackId, localSamples);
    expect(post, "Expected post-insertion interpolator").toBeTruthy();
    const postVals = post!;

    // Compare samples with a small tolerance
    for (let i = 0; i < localSamples.length; i++) {
      const a = preVals[i];
      const b = postVals[i];
      // We only require neighborhood-level agreement to account for numeric error in time inversion and normalization.
      expect(Math.abs(a - b)).toBeLessThan(2e-4);
    }
  });

  it("stores inferred auto-clamped directives when inferred defaults are selected", async () => {
    const store = createMinimalAnimationStore({ trackBaker: clipBaker });
    store.getState().setPreferences({
      newKeyDefaults: {
        transitions: {
          in: TransitionDirective.InferredAutoClamped,
          out: TransitionDirective.InferredAutoClamped,
        },
      },
    });

    const state0 = store.getState();
    const trackId = Object.keys(state0.tracks)[0];
    const { instanceId, timescale, offset } = resolveSingleNamespaceAndInstance(state0);
    const { mid: localMid } = findMidSegmentLocalStamp(state0, trackId);
    const worldStamp = computeWorldStamp(localMid, timescale, offset);

    store.getState().insertKeypointAtWorldStamp(trackId, worldStamp, instanceId);
    await flushMicrotasks();

    const inserted = store
      .getState()
      .tracks[trackId].points.find((point) => Math.abs(point.stamp - localMid) < 1e-6);
    expect(inserted).toBeTruthy();
    expect(inserted?.transitions?.in).toBe(TransitionDirective.InferredAutoClamped);
    expect(inserted?.transitions?.out).toBe(TransitionDirective.InferredAutoClamped);
  });

  it("applies the configured default to BOTH sides when inserted at the end of a track", async () => {
    // Regression: previously the missing-neighbor side was left undefined,
    // which the toolbar normalizer rendered as cubic — silently dropping the
    // user's chosen default for the trailing handle. Both sides should now
    // carry the user's preference even when no nextPoint exists.
    const store = createMinimalAnimationStore({ trackBaker: clipBaker });
    store.getState().setPreferences({
      newKeyDefaults: {
        transitions: {
          in: TransitionDirective.InferredAutoClamped,
          out: TransitionDirective.InferredAutoClamped,
        },
      },
    });

    const state0 = store.getState();
    const trackId = Object.keys(state0.tracks)[0];
    const { instanceId, timescale, offset } = resolveSingleNamespaceAndInstance(state0);
    const sortedBefore = state0.tracks[trackId].points.slice().sort((a, b) => a.stamp - b.stamp);
    const lastStamp = sortedBefore[sortedBefore.length - 1].stamp;
    const insertLocal = lastStamp + 0.1;
    const worldStamp = computeWorldStamp(insertLocal, timescale, offset);

    store.getState().insertKeypointAtWorldStamp(trackId, worldStamp, instanceId);
    await flushMicrotasks();

    const inserted = store
      .getState()
      .tracks[trackId].points.find((point) => Math.abs(point.stamp - insertLocal) < 1e-6);
    expect(inserted).toBeTruthy();
    expect(inserted?.transitions?.in).toBe(TransitionDirective.InferredAutoClamped);
    expect(inserted?.transitions?.out).toBe(TransitionDirective.InferredAutoClamped);
  });

  it("applies the configured default to BOTH sides when inserted at the start of a track", async () => {
    // Mirror of the end-insertion regression: prepend should also carry
    // both `in` and `out` from preferences even though there's no prevPoint.
    const store = createMinimalAnimationStore({ trackBaker: clipBaker });
    store.getState().setPreferences({
      newKeyDefaults: {
        transitions: {
          in: TransitionDirective.InferredAutoClamped,
          out: TransitionDirective.InferredAutoClamped,
        },
      },
    });

    const state0 = store.getState();
    const trackId = Object.keys(state0.tracks)[0];
    const { instanceId, timescale, offset } = resolveSingleNamespaceAndInstance(state0);
    const sortedBefore = state0.tracks[trackId].points.slice().sort((a, b) => a.stamp - b.stamp);
    const firstStamp = sortedBefore[0].stamp;
    const insertLocal = firstStamp - 0.1;
    const worldStamp = computeWorldStamp(insertLocal, timescale, offset);

    store.getState().insertKeypointAtWorldStamp(trackId, worldStamp, instanceId);
    await flushMicrotasks();

    const inserted = store
      .getState()
      .tracks[trackId].points.find((point) => Math.abs(point.stamp - insertLocal) < 1e-6);
    expect(inserted).toBeTruthy();
    expect(inserted?.transitions?.in).toBe(TransitionDirective.InferredAutoClamped);
    expect(inserted?.transitions?.out).toBe(TransitionDirective.InferredAutoClamped);
  });

  it("updateKeypoint inserts a new keypoint with the configured transition defaults", async () => {
    // Regression: slider-driven keypoint creation (setValueAction →
    // updateKeypoint) used to skip the default-application path entirely,
    // leaving transitions undefined and rendering as cubic.
    const store = createMinimalAnimationStore({ trackBaker: clipBaker });
    store.getState().setPreferences({
      newKeyDefaults: {
        transitions: {
          in: TransitionDirective.InferredAutoClamped,
          out: TransitionDirective.InferredAutoClamped,
        },
      },
    });

    const state0 = store.getState();
    const trackId = Object.keys(state0.tracks)[0];
    const sortedBefore = state0.tracks[trackId].points.slice().sort((a, b) => a.stamp - b.stamp);
    const newStamp = (sortedBefore[0].stamp + sortedBefore[1].stamp) / 2;

    store.getState().updateKeypoint(trackId, { stamp: newStamp, value: 0.5 });
    await flushMicrotasks();

    const inserted = store
      .getState()
      .tracks[trackId].points.find((point) => Math.abs(point.stamp - newStamp) < 1e-6);
    expect(inserted).toBeTruthy();
    expect(inserted?.transitions?.in).toBe(TransitionDirective.InferredAutoClamped);
    expect(inserted?.transitions?.out).toBe(TransitionDirective.InferredAutoClamped);
  });

  it("uses inferred handles for explicit defaults when split insertion is unavailable", async () => {
    const store = createMinimalAnimationStore({ trackBaker: clipBaker });
    store.getState().setPreferences({
      newKeyDefaults: {
        transitions: {
          in: TransitionDirective.ExplicitHandles,
          out: TransitionDirective.ExplicitHandles,
        },
      },
    });

    const state0 = store.getState();
    const trackId = Object.keys(state0.tracks)[0];
    const { instanceId, timescale, offset } = resolveSingleNamespaceAndInstance(state0);
    const sortedBefore = state0.tracks[trackId].points.slice().sort((a, b) => a.stamp - b.stamp);

    // Insert at an existing interior stamp to force non-split fallback logic.
    const insertionIndex = 1;
    const insertionStamp = sortedBefore[insertionIndex].stamp;
    const prev = sortedBefore[insertionIndex];
    const next = sortedBefore[insertionIndex + 1];
    const beforeIds = new Set(state0.tracks[trackId].points.map((point) => point.id));

    const worldStamp = computeWorldStamp(insertionStamp, timescale, offset);
    store.getState().insertKeypointAtWorldStamp(trackId, worldStamp, instanceId);
    await flushMicrotasks();

    const state1 = store.getState();
    const inserted = state1.tracks[trackId].points.find((point) => !beforeIds.has(point.id));
    expect(inserted).toBeTruthy();
    expect(typeof inserted?.value).toBe("number");
    expect(typeof prev.value).toBe("number");
    expect(typeof next.value).toBe("number");

    const inferred = inferAutoHandleDeltas({
      prev: { stamp: prev.stamp, value: prev.value as number },
      anchor: { stamp: inserted?.stamp ?? insertionStamp, value: inserted?.value as number },
      next: { stamp: next.stamp, value: next.value as number },
    });
    expect(inferred).toBeTruthy();

    expect(inserted?.transitions).toBeTruthy();
    expect(typeof inserted?.transitions?.in).toBe("object");
    expect(typeof inserted?.transitions?.out).toBe("object");

    const inTransition = inserted?.transitions?.in;
    const outTransition = inserted?.transitions?.out;
    if (!inTransition || typeof inTransition !== "object") {
      throw new Error("Expected explicit incoming transition");
    }
    if (!outTransition || typeof outTransition !== "object") {
      throw new Error("Expected explicit outgoing transition");
    }

    expect(inTransition.x).toBeCloseTo(inferred?.in.x ?? 0, 8);
    expect(inTransition.y).toBeCloseTo(inferred?.in.y ?? 0, 8);
    expect(outTransition.x).toBeCloseTo(inferred?.out.x ?? 0, 8);
    expect(outTransition.y).toBeCloseTo(inferred?.out.y ?? 0, 8);
  });
});
