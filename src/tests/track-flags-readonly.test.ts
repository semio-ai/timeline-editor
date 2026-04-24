import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  INSTANCE_IDS,
  NAMESPACE_IDS,
  TRACK_IDS,
  createTestAnimationStore,
} from "../test-fixtures/animation-store-factory";
import type { AnimationStore } from "../store";
import { collectSourceTracks } from "../functions";
import { flushMicrotasks } from "./utils/flush-microtasks";

const sourceRowId = `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${TRACK_IDS.SCALE}`;

const findTrack = (store: AnimationStore, trackId: string) =>
  collectSourceTracks(store.getState().globalSourceTree).find((t) => t.id === trackId);

describe("track-flags policy on readonly tracks", () => {
  let store: AnimationStore;
  let cleanup: (() => void) | undefined;

  beforeEach(async () => {
    store = createTestAnimationStore({ activeInstance: INSTANCE_IDS.ALPHA_SHARED });
    cleanup = store.getState().initAnimationSubscriptions();
    await flushMicrotasks();
    store.getState().setSourcesReadonly([sourceRowId], true);
    await flushMicrotasks();
  });

  afterEach(() => {
    cleanup?.();
  });

  it("setTracksLocked is a no-op for readonly sources (cannot user-clear an enforced lock)", () => {
    const initialLocked = findTrack(store, sourceRowId)?.locked ?? false;
    store.getState().setTracksLocked([sourceRowId], true);
    expect(findTrack(store, sourceRowId)?.locked ?? false).toBe(initialLocked);

    store.getState().setTracksLocked([sourceRowId], false);
    expect(findTrack(store, sourceRowId)?.locked ?? false).toBe(initialLocked);
  });

  it("setTracksLocked still applies to non-readonly ids passed in the same batch", () => {
    const otherSourceId = `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${TRACK_IDS.OPACITY}`;
    store.getState().setTracksLocked([sourceRowId, otherSourceId], true);
    // readonly source: still has its original locked state
    expect(findTrack(store, sourceRowId)?.locked ?? false).toBe(false);
    // writable source: locked applied
    expect(findTrack(store, otherSourceId)?.locked).toBe(true);
  });

  it("setTracksMuted succeeds on readonly sources (view state, not authoring)", () => {
    store.getState().setTracksMuted([sourceRowId], true);
    expect(findTrack(store, sourceRowId)?.muted).toBe(true);

    store.getState().setTracksMuted([sourceRowId], false);
    expect(findTrack(store, sourceRowId)?.muted).toBe(false);
  });

  it("setTracksVisible succeeds on readonly sources (view state, not authoring)", () => {
    store.getState().setTracksVisible([sourceRowId], false);
    expect(findTrack(store, sourceRowId)?.visible).toBe(false);

    store.getState().setTracksVisible([sourceRowId], true);
    expect(findTrack(store, sourceRowId)?.visible).toBe(true);
  });

  it("setSourcesReadonly(false) clears the flag and re-enables authoring", async () => {
    expect(findTrack(store, sourceRowId)?.readonly).toBe(true);
    store.getState().setSourcesReadonly([sourceRowId], false);
    await flushMicrotasks();
    expect(findTrack(store, sourceRowId)?.readonly).toBe(false);
    // Now setTracksLocked succeeds
    store.getState().setTracksLocked([sourceRowId], true);
    expect(findTrack(store, sourceRowId)?.locked).toBe(true);
  });

  it("setAnimationReadonly flips every track belonging to the animation", async () => {
    // Clear the per-source readonly we set in beforeEach.
    store.getState().setSourcesReadonly([sourceRowId], false);
    await flushMicrotasks();

    const sharedAnimationId = "shared-animation";
    store.getState().setAnimationReadonly(sharedAnimationId, true);
    await flushMicrotasks();

    const tracks = collectSourceTracks(store.getState().globalSourceTree);
    const fromShared = tracks.filter((t) => t.animationId === sharedAnimationId);
    expect(fromShared.length).toBeGreaterThan(0);
    fromShared.forEach((t) => {
      expect(t.readonly).toBe(true);
    });

    // Tracks from other animations are untouched.
    const fromOther = tracks.filter((t) => t.animationId !== sharedAnimationId);
    fromOther.forEach((t) => {
      expect(t.readonly ?? false).toBe(false);
    });
  });
});
