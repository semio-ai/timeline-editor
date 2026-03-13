import { useEffect, useLayoutEffect } from "react";
import { PlayerData, usePlayerStore } from "@semio/utils";

/**
 * A hook used to subscribe to changes in the player store.
 * @param selector - A function that takes the store and returns the value you want to access.
 * @param callback - A function that will be called when the value returned by the selector changes.
 * @param equalityFn - A function that takes the previous and current value returned by the selector and returns true if they are equal.
 */
export function usePlayerSubscription<T>(
  selector: (data: PlayerData) => T,
  callback: (data: T, previous: T) => void,
  equalityFn: (a: T, b: T) => boolean = (a, b) => a === b,
) {
  useEffect(() => {
    const unsubscribe = usePlayerStore.subscribe(
      selector,
      (next: T, prev: T) => {
        if (!equalityFn(next, prev)) {
          callback(next, prev);
        }
      },
      { equalityFn, fireImmediately: true },
    );
    return unsubscribe;
  }, [selector, callback, equalityFn]);
}

export function useLayoutPlayerSubscription<T>(
  selector: (data: PlayerData) => T,
  callback: (data: T, previous: T) => void,
  equalityFn: (a: T, b: T) => boolean = (a, b) => a === b,
) {
  useLayoutEffect(() => {
    const unsubscribe = usePlayerStore.subscribe(
      selector,
      (next: T, prev: T) => {
        if (!equalityFn(next, prev)) {
          callback(next, prev);
        }
      },
      { equalityFn },
    );
    return unsubscribe;
  }, [selector, callback, equalityFn]);
}
