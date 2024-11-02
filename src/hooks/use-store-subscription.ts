import { useContext, useEffect } from "react";
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
  callback: (data: T) => void,
  equalityFn: (a: T, b: T) => boolean = (a, b) => a === b,
) {
  const store = useContext(AnimationContext);

  if (!store) {
    throw new Error("useStoreSubscription must be used within an AnimationProvider");
  }

  useEffect(() => {
    const unsubscribe = store.subscribe(selector, callback, { equalityFn, fireImmediately: true });
    return unsubscribe;
  }, [selector, callback, equalityFn, store]);
}
