import { useContext, useEffect, useRef } from "react";
import type { AnimationData } from "../store-types";
import { AnimationContext } from "../context";

/**
 * A hook used to subscribe to changes in the store. Must be used within a AnimationProvider.
 * @param selector - A function that takes the store and returns the value you want to access.
 * @param callback - A function that will be called when the value returned by the selector changes.
 * @param equalityFn - A function that takes the previous and current value returned by the selector and returns true if they are equal.
 */
export function useStoreSubscription<T>(
  selector: (data: AnimationData) => T,
  callback: (data: T, previous: T) => void,
  equalityFn: (a: T, b: T) => boolean = (a, b) => a === b,
) {
  const store = useContext(AnimationContext);

  if (!store) {
    throw new Error("useStoreSubscription must be used within an AnimationProvider");
  }

  // Keep the latest selector/callback/equality in refs to avoid resubscribe loops
  const selectorRef = useRef(selector);
  const callbackRef = useRef(callback);
  const equalityRef = useRef(equalityFn);

  selectorRef.current = selector;
  callbackRef.current = callback;
  equalityRef.current = equalityFn;

  useEffect(() => {
    const stableSelector = (state: AnimationData) => selectorRef.current(state);
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

    const unsubscribe = store.subscribe(stableSelector, stableCallback, {
      equalityFn: stableEquality,
      fireImmediately: true,
    });
    return unsubscribe;
  }, [store]);
}
