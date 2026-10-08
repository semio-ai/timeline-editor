import { useEffect, useLayoutEffect } from "react";
import type { PlayerData } from "@semio/utils";
import { useAnimationStore } from "./use-animation-store";

/**
 * A hook used to subscribe to changes in the player of the animation store in context.
 * @param selector - A function that takes the store and returns the value you want to access.
 * @param callback - A function that will be called when the value returned by the selector changes.
 * @param equalityFn - A function that takes the previous and current value returned by the selector and returns true if they are equal.
 */
export function usePlayerSubscription<T>(
  selector: (data: PlayerData) => T,
  callback: (data: T, previous: T) => void,
  equalityFn: (a: T, b: T) => boolean = (a, b) => a === b,
) {
  const playerStore = useAnimationStore((state) => state.playerStore);
  useEffect(() => {
    const unsubscribe = playerStore.subscribe(
      selector,
      (next: T, prev: T) => {
        if (!equalityFn(next, prev)) {
          callback(next, prev);
        }
      },
      { equalityFn, fireImmediately: true },
    );
    return unsubscribe;
  }, [playerStore, selector, callback, equalityFn]);
}

export function useLayoutPlayerSubscription<T>(
  selector: (data: PlayerData) => T,
  callback: (data: T, previous: T) => void,
  equalityFn: (a: T, b: T) => boolean = (a, b) => a === b,
) {
  const playerStore = useAnimationStore((state) => state.playerStore);
  useLayoutEffect(() => {
    const unsubscribe = playerStore.subscribe(
      selector,
      (next: T, prev: T) => {
        if (!equalityFn(next, prev)) {
          callback(next, prev);
        }
      },
      { equalityFn },
    );
    return unsubscribe;
  }, [playerStore, selector, callback, equalityFn]);
}
