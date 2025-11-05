import { useEffect, useLayoutEffect, useRef } from "react";
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
  const selectorRef = useRef(selector);
  const callbackRef = useRef(callback);
  const equalityRef = useRef(equalityFn);

  // Keep refs up to date without changing the subscription identity
  selectorRef.current = selector;
  callbackRef.current = callback;
  equalityRef.current = equalityFn;

  useEffect(() => {
    const stableSelector = (state: PlayerData) => selectorRef.current(state);
    const stableCallback = (next: T, prev: T) => {
      const eq = equalityRef.current ?? ((a: T, b: T) => a === b);
      if (!eq(next, prev)) {
        callbackRef.current(next, prev);
      }
    };
    const stableEquality = (a: T, b: T) => {
      const eq = equalityRef.current;
      return eq ? eq(a, b) : a === b;
    };

    const unsubscribe = usePlayerStore.subscribe(stableSelector, stableCallback, {
      equalityFn: stableEquality,
      fireImmediately: true,
    });
    return unsubscribe;
  }, []);
}

export function useLayoutPlayerSubscription<T>(
  selector: (data: PlayerData) => T,
  callback: (data: T, previous: T) => void,
  equalityFn: (a: T, b: T) => boolean = (a, b) => a === b,
) {
  const selectorRef = useRef(selector);
  const callbackRef = useRef(callback);
  const equalityRef = useRef(equalityFn);

  // Keep refs up to date without changing the subscription identity
  selectorRef.current = selector;
  callbackRef.current = callback;
  equalityRef.current = equalityFn;

  useLayoutEffect(() => {
    const stableSelector = (state: PlayerData) => selectorRef.current(state);
    const stableCallback = (next: T, prev: T) => {
      const eq = equalityRef.current ?? ((a: T, b: T) => a === b);
      if (!eq(next, prev)) {
        callbackRef.current(next, prev);
      }
    };
    const stableEquality = (a: T, b: T) => {
      const eq = equalityRef.current;
      return eq ? eq(a, b) : a === b;
    };

    const unsubscribe = usePlayerStore.subscribe(stableSelector, stableCallback, {
      equalityFn: stableEquality,
      fireImmediately: true,
    });
    return unsubscribe;
  }, []);
}
