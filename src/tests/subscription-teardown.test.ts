// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { createTestAnimationStore } from "../test-fixtures/animation-store-factory";
import type { AnimationStore } from "../store";
import { clipBaker } from "./module-clip/clip-baker";

/**
 * What `initAnimationSubscriptions()`'s cleanup must stop. A host that disposes
 * an animation store — Studio, closing a project — relies on it to end all of
 * that store's work on its player, which the host may share with the next
 * store (Studio's is one for the page): a subscription that survives keeps
 * acting on a player the next store reads.
 */

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * Records every subscription opened on `store`'s player from now on, as its
 * unsubscribe: a spy on the one that was opened.
 */
function trackPlayerSubscriptions(store: AnimationStore): ReturnType<typeof vi.fn>[] {
  const player = store.getState().playerStore;
  const opened: ReturnType<typeof vi.fn>[] = [];
  const subscribe = player.subscribe.bind(player) as (...args: unknown[]) => () => void;
  vi.spyOn(player, "subscribe").mockImplementation(((...args: unknown[]) => {
    const unsubscribe = vi.fn(subscribe(...args));
    opened.push(unsubscribe);
    return unsubscribe;
  }) as typeof player.subscribe);
  return opened;
}

/**
 * A store with its subscriptions started, the cleanup that stops them, and
 * the subscriptions they opened on its player.
 */
function startedStore() {
  const store = createTestAnimationStore({ trackBaker: clipBaker });
  const opened = trackPlayerSubscriptions(store);
  // Re-initialising tears down the set the factory started and hands back a
  // cleanup for the new one.
  const cleanup = store.getState().initAnimationSubscriptions();
  return { store, cleanup, opened };
}

describe("animation subscription teardown", () => {
  test("closes the subscriptions the store opened on its player", () => {
    const { cleanup, opened } = startedStore();
    expect(opened.length).toBeGreaterThan(0);

    cleanup();

    opened.forEach((unsubscribe) => expect(unsubscribe).toHaveBeenCalled());
  });

  test("a cleanup spent by a later initialisation leaves that initialisation's subscriptions open", () => {
    const { store, cleanup: first, opened: before } = startedStore();
    const startedFirst = before.length;
    const second = store.getState().initAnimationSubscriptions();
    const opened = before.slice(startedFirst);
    expect(opened.length).toBeGreaterThan(0);

    first();

    opened.forEach((unsubscribe) => expect(unsubscribe).not.toHaveBeenCalled());
    second();
    opened.forEach((unsubscribe) => expect(unsubscribe).toHaveBeenCalled());
  });

  test("stopAnimationSubscriptions stops the current set, whichever call started it", () => {
    const { store, opened: before } = startedStore();
    const startedFirst = before.length;
    store.getState().initAnimationSubscriptions();
    const opened = before.slice(startedFirst);
    expect(opened.length).toBeGreaterThan(0);

    store.getState().stopAnimationSubscriptions();

    opened.forEach((unsubscribe) => expect(unsubscribe).toHaveBeenCalled());
  });
});
