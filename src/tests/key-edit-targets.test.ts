import { describe, expect, it } from "vitest";
import type { AnimationData } from "../store-types";
import { TrackRender } from "../types";
import { findKeypointAtWorldStamp, resolveKeyTargets } from "../functions/key-edit-targets";

// Minimal state literals — these helpers only read namespaces/tracks/selection.
function stateWith(partial: Partial<AnimationData>): AnimationData {
  return partial as unknown as AnimationData;
}

describe("resolveKeyTargets", () => {
  const splineState = stateWith({
    selectionState: {
      instanceId: "inst-1",
      keypoints: new Map([
        ["trackA", new Set(["k"])],
        ["trackB", new Set(["k"])],
      ]),
      reference: null,
    } as AnimationData["selectionState"],
  });

  it("spline view targets the current selection (all selected tracks, one instance)", () => {
    expect(resolveKeyTargets(splineState, { trackRender: TrackRender.Spline })).toEqual([
      { trackId: "trackA", instanceId: "inst-1" },
      { trackId: "trackB", instanceId: "inst-1" },
    ]);
  });

  it("spline view yields nothing when no instance is active", () => {
    const noInstance = stateWith({
      selectionState: {
        instanceId: null,
        keypoints: new Map([["trackA", new Set(["k"])]]),
        reference: null,
      } as AnimationData["selectionState"],
    });
    expect(resolveKeyTargets(noInstance, { trackRender: TrackRender.Spline })).toEqual([]);
  });

  it("non-spline view targets the clicked row, ignoring selection", () => {
    const rowTargets = [{ trackId: "rowTrack", instanceId: "inst-9" }];
    expect(resolveKeyTargets(splineState, { trackRender: TrackRender.Key, rowTargets })).toEqual(
      rowTargets,
    );
  });

  it("non-spline view with no row context yields nothing", () => {
    expect(resolveKeyTargets(splineState, { trackRender: TrackRender.Key })).toEqual([]);
  });
});

describe("findKeypointAtWorldStamp", () => {
  const state = stateWith({
    namespaces: {
      ns: { animationInstances: { "inst-1": { settings: { offset: 0, timescale: 1 } } } },
    } as unknown as AnimationData["namespaces"],
    tracks: {
      trackA: { points: [{ id: "k1", stamp: 100, value: 0 }] },
    } as unknown as AnimationData["tracks"],
  });
  const target = { trackId: "trackA", instanceId: "inst-1" };

  it("matches a key at the stamp (within frame tolerance)", () => {
    expect(findKeypointAtWorldStamp(state, target, 100)).toBe("k1");
    expect(findKeypointAtWorldStamp(state, target, 100.05)).toBe("k1");
  });

  it("returns undefined away from any key, or for an unknown track", () => {
    expect(findKeypointAtWorldStamp(state, target, 105)).toBeUndefined();
    expect(findKeypointAtWorldStamp(state, { trackId: "missing", instanceId: "inst-1" }, 100)).toBeUndefined();
  });

  it("converts the world stamp into the instance's local frame before matching", () => {
    // offset 500, timescale 2 → local = (world - 500) * 2. Key stored at local 200
    // lives at world = 200/2 + 500 = 600.
    const scaled = stateWith({
      namespaces: {
        ns: { animationInstances: { inst: { settings: { offset: 500, timescale: 2 } } } },
      } as unknown as AnimationData["namespaces"],
      tracks: {
        t: { points: [{ id: "k", stamp: 200, value: 0 }] },
      } as unknown as AnimationData["tracks"],
    });
    expect(findKeypointAtWorldStamp(scaled, { trackId: "t", instanceId: "inst" }, 600)).toBe("k");
    // The same world stamp would NOT match if we ignored the transform (local 600 != 200).
    expect(findKeypointAtWorldStamp(scaled, { trackId: "t", instanceId: "inst" }, 200)).toBeUndefined();
  });
});
