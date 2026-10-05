// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { usePlayerStore, useValuesStore } from "@semio/utils";
import { createTestAnimationStore } from "../test-fixtures/animation-store-factory";

/**
 * What `initAnimationSubscriptions()`'s cleanup must stop. A host that disposes
 * an animation store — Studio, closing a project — relies on it to end all of
 * that store's work on the shared player and values stores, not only its
 * listeners: a subscription or a queued write that survives keeps acting on
 * the singletons the next store reads.
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

/**
 * Records every subscription opened on the shared player store from now on,
 * as its unsubscribe: a spy on the one that was opened.
 */
function trackPlayerSubscriptions(): ReturnType<typeof vi.fn>[] {
  const opened: ReturnType<typeof vi.fn>[] = [];
  const subscribe = usePlayerStore.subscribe.bind(usePlayerStore) as (
    ...args: unknown[]
  ) => () => void;
  vi.spyOn(usePlayerStore, "subscribe").mockImplementation(((...args: unknown[]) => {
    const unsubscribe = vi.fn(subscribe(...args));
    opened.push(unsubscribe);
    return unsubscribe;
  }) as typeof usePlayerStore.subscribe);
  return opened;
}

describe("animation subscription teardown", () => {
  test("closes the subscriptions the store opened on the player store", () => {
    const opened = trackPlayerSubscriptions();
    const { cleanup } = startedStore();
    expect(opened.length).toBeGreaterThan(0);

    cleanup();

    opened.forEach((unsubscribe) => expect(unsubscribe).toHaveBeenCalled());
  });

  test("a cleanup spent by a later initialisation leaves that initialisation's subscriptions open", () => {
    const { store, cleanup: first } = startedStore();
    const opened = trackPlayerSubscriptions();
    const second = store.getState().initAnimationSubscriptions();
    expect(opened.length).toBeGreaterThan(0);

    first();

    opened.forEach((unsubscribe) => expect(unsubscribe).not.toHaveBeenCalled());
    second();
    opened.forEach((unsubscribe) => expect(unsubscribe).toHaveBeenCalled());
  });

  test("stopAnimationSubscriptions stops the current set, whichever call started it", () => {
    const { store } = startedStore();
    const opened = trackPlayerSubscriptions();
    store.getState().initAnimationSubscriptions();
    expect(opened.length).toBeGreaterThan(0);

    store.getState().stopAnimationSubscriptions();

    opened.forEach((unsubscribe) => expect(unsubscribe).toHaveBeenCalled());
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
