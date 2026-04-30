import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
  ANIMATABLE_IDS,
  ANIMATION_IDS,
  INSTANCE_IDS,
  TRACK_IDS,
  createTestAnimationStore,
} from "../test-fixtures/animation-store-factory";
import type { AnimationStore } from "../store";
import { flushMicrotasks } from "./utils/flush-microtasks";

/**
 * Coverage for the animation-level readonly gate (`readonlyAnimations`)
 * applied to track-CRUD actions where the per-track `readonly` flag is
 * insufficient — `createTrack` (the new track doesn't exist yet) and
 * `removeTrack` on an animation whose tracks are all readonly.
 *
 * The complementary per-track gate (keypoint mutations, updateTrack, etc.)
 * is covered by `readonly-mutation-meta.test.ts`.
 */

describe("animation-level readonly gate", () => {
  let store: AnimationStore;
  let cleanup: (() => void) | undefined;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    store = createTestAnimationStore({
      includeNamespaceA: true,
      includeNamespaceB: true,
      activeInstance: INSTANCE_IDS.ALPHA_SHARED,
    });
    cleanup = store.getState().initAnimationSubscriptions();
    await flushMicrotasks();
    // Mark the entire SHARED animation readonly via the studio-side path.
    // This sets both per-track readonly flags AND `readonlyAnimations`.
    store.getState().setAnimationReadonly(ANIMATION_IDS.SHARED, true);
    await flushMicrotasks();
    // Suppress the gate's dev-observability warnings during tests; assertions
    // below check that the warning fired when the gate engaged.
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    cleanup?.();
  });

  it("populates readonlyAnimations when setAnimationReadonly(true) is called", () => {
    expect(store.getState().readonlyAnimations[ANIMATION_IDS.SHARED]).toBe(true);
  });

  it("clears readonlyAnimations when setAnimationReadonly(false) is called", async () => {
    store.getState().setAnimationReadonly(ANIMATION_IDS.SHARED, false);
    await flushMicrotasks();
    expect(store.getState().readonlyAnimations[ANIMATION_IDS.SHARED]).toBeUndefined();
  });

  it("createTrack is a no-op on a readonly animation", async () => {
    const beforeAnimation = store.getState().animations[ANIMATION_IDS.SHARED];
    const beforeTrackCount = beforeAnimation.tracks.length;
    const beforeTrackIds = new Set(Object.keys(store.getState().tracks));

    store
      .getState()
      .createTrack({ name: "added-after-lock" }, ANIMATABLE_IDS.WIDTH, ANIMATION_IDS.SHARED);
    await flushMicrotasks();

    const afterAnimation = store.getState().animations[ANIMATION_IDS.SHARED];
    expect(afterAnimation.tracks.length).toBe(beforeTrackCount);
    expect(new Set(Object.keys(store.getState().tracks))).toEqual(beforeTrackIds);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(`createTrack blocked: animation ${ANIMATION_IDS.SHARED} is readonly`),
    );
  });

  it("createTrack still works on a writable animation in the same store", async () => {
    const beforeTracks = store.getState().animations[ANIMATION_IDS.NAMESPACE_A].tracks.length;

    store
      .getState()
      .createTrack({ name: "ok-on-writable" }, ANIMATABLE_IDS.HEIGHT, ANIMATION_IDS.NAMESPACE_A);
    await flushMicrotasks();

    expect(store.getState().animations[ANIMATION_IDS.NAMESPACE_A].tracks.length).toBe(
      beforeTracks + 1,
    );
  });

  it("removeTrack is a no-op on a track in a readonly animation", async () => {
    const beforeTrackCount = store.getState().animations[ANIMATION_IDS.SHARED].tracks.length;
    const beforeTrack = store.getState().tracks[TRACK_IDS.SCALE];
    expect(beforeTrack).toBeDefined();

    store.getState().removeTrack(TRACK_IDS.SCALE, ANIMATION_IDS.SHARED);
    await flushMicrotasks();

    expect(store.getState().animations[ANIMATION_IDS.SHARED].tracks.length).toBe(beforeTrackCount);
    expect(store.getState().tracks[TRACK_IDS.SCALE]).toBeDefined();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(`removeTrack blocked: animation ${ANIMATION_IDS.SHARED} is readonly`),
    );
  });

  it("removeTrack still works on a track in a writable animation", async () => {
    const beforeTrackCount = store.getState().animations[ANIMATION_IDS.NAMESPACE_A].tracks.length;
    expect(store.getState().tracks[TRACK_IDS.WIDTH]).toBeDefined();

    store.getState().removeTrack(TRACK_IDS.WIDTH, ANIMATION_IDS.NAMESPACE_A);
    await flushMicrotasks();

    expect(store.getState().animations[ANIMATION_IDS.NAMESPACE_A].tracks.length).toBe(
      beforeTrackCount - 1,
    );
    expect(store.getState().tracks[TRACK_IDS.WIDTH]).toBeUndefined();
  });
});
