import { describe, expect, it } from "vitest";
import type { RawValue } from "@semio/utils";
import { attachModuleBaker } from "../../module-baker";
import { createTestAnimationStore } from "../../test-fixtures/animation-store-factory";
import type { AnimationStore } from "../../store";
import type { Track } from "../../types";
import { curveOf } from "../curves";

/** Resolves once `ready` holds, checking at each turn of the event loop. */
async function until(ready: () => boolean, timeoutMs = 120_000): Promise<void> {
  const start = Date.now();
  while (!ready()) {
    if (Date.now() - start > timeoutMs) throw new Error("timed out");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

/** The snapshot's tracks, each with whether it has a baked curve. */
function bakedTracks(store: AnimationStore) {
  return Object.entries(store.getState().derivedSnapshot?.tracks ?? {}).map(([key, track]) => ({
    key,
    track,
    baked: track.canonical.curve(0) !== undefined,
  }));
}

describe("attachModuleBaker", () => {
  it("draws every curve from the Vizij animation module, with no device, and takes the baker back", async () => {
    const store = createTestAnimationStore();
    expect(store.getState().trackBaker).toBeUndefined();
    expect(bakedTracks(store).some((t) => t.baked)).toBe(false);

    const detach = attachModuleBaker(store);
    expect(store.getState().trackBaker).toBeDefined();

    await until(() => {
      const tracks = bakedTracks(store);
      return tracks.length > 0 && tracks.every((t) => t.baked);
    });

    // Each curve is the module's: it matches the clip as the module samples
    // it (the tests' `clipBaker`, which the module's own fidelity tests hold
    // to the module) at points between and on the samples.
    const state = store.getState();
    let compared = 0;
    for (const { track } of bakedTracks(store)) {
      const trackId = track.metadata?.trackId;
      const stored = trackId ? state.tracks[trackId] : undefined;
      const animation = Object.values(state.animations).find((a) => a.tracks.includes(trackId!));
      if (!stored || !animation) throw new Error(`no stored track for ${trackId}`);
      const reference = curveOf(stored as Track<RawValue>, animation, state.tracks);
      const duration = reference.durationMs;
      for (let t = 0; t <= duration; t += duration / 37) {
        const expected = reference(t);
        const actual = track.canonical.curve(t);
        if (typeof expected === "number") {
          expect(actual).toBeCloseTo(expected, 3);
        } else {
          expect(actual).toBe(expected);
        }
        compared++;
      }
    }
    expect(compared).toBeGreaterThan(100);

    detach();
    expect(store.getState().trackBaker).toBeUndefined();
  }, 180_000);
});
