// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { usePlayerStore, useValuesStore } from "@semio/utils";
import { createTestAnimationStore } from "../test-fixtures/animation-store-factory";

/**
 * What `initAnimationSubscriptions()`'s cleanup must stop. A host that disposes
 * an animation store — Studio, closing a project — relies on it to end all of
 * that store's work on the shared player and values stores, not only its
 * listeners: an interval or a queued write that survives keeps acting on the
 * singletons the next store reads.
 */

afterEach(() => {
  usePlayerStore.getState().pausePlayer();
  usePlayerStore.getState().resetPlayer(0);
  vi.restoreAllMocks();
});

/** A store with its subscriptions started, and the cleanup that stops them. */
function startedStore() {
  const store = createTestAnimationStore();
  // Re-initialising tears down the set the factory started and hands back a
  // cleanup for the new one.
  const cleanup = store.getState().initAnimationSubscriptions();
  return { store, cleanup };
}

describe("animation subscription teardown", () => {
  test("stops the player interval the store started", () => {
    const clearInterval = vi.spyOn(window, "clearInterval");
    const { store, cleanup } = startedStore();

    usePlayerStore.getState().playPlayer();
    const interval = store.getState().playerInterval;
    expect(interval).toBeDefined();

    cleanup();

    expect(clearInterval).toHaveBeenCalledWith(interval);
    expect(store.getState().playerInterval).toBeUndefined();
  });

  test("a cleanup spent by a later initialisation leaves that initialisation's interval running", () => {
    const { store, cleanup: first } = startedStore();
    usePlayerStore.getState().playPlayer();

    const second = store.getState().initAnimationSubscriptions();
    const secondInterval = store.getState().playerInterval;
    expect(secondInterval).toBeDefined();

    first();

    expect(store.getState().playerInterval).toBe(secondInterval);
    second();
    expect(store.getState().playerInterval).toBeUndefined();
  });

  test("stopAnimationSubscriptions stops the current set, whichever call started it", () => {
    const clearInterval = vi.spyOn(window, "clearInterval");
    const { store } = startedStore();
    store.getState().initAnimationSubscriptions();
    usePlayerStore.getState().playPlayer();
    const interval = store.getState().playerInterval;
    expect(interval).toBeDefined();

    store.getState().stopAnimationSubscriptions();

    expect(clearInterval).toHaveBeenCalledWith(interval);
    expect(store.getState().playerInterval).toBeUndefined();
    // Stopped, not restarted: a later play reaches no subscription of this store.
    usePlayerStore.getState().pausePlayer();
    usePlayerStore.getState().playPlayer();
    expect(store.getState().playerInterval).toBeUndefined();
  });

  test("a playback write queued before teardown writes nothing after it", async () => {
    const { cleanup } = startedStore();
    const stamp = usePlayerStore.getState().player.stamp;

    // Control: with the store live, a playhead move is written to the values store.
    useValuesStore.setState({ values: new Map(), velocities: new Map() });
    usePlayerStore.getState().resetPlayer(stamp + 0.25);
    await Promise.resolve();
    expect(useValuesStore.getState().values.size).toBeGreaterThan(0);

    // A move whose write is queued as a microtask, then teardown before it runs.
    useValuesStore.setState({ values: new Map(), velocities: new Map() });
    usePlayerStore.getState().resetPlayer(stamp + 0.5);
    cleanup();
    await Promise.resolve();

    expect(useValuesStore.getState().values.size).toBe(0);
  });
});
