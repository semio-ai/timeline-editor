import { useContext } from "react";
import { useStore } from "zustand";
import type { AnimationData, AnimationActions } from "../store-types";
import { AnimationContext } from "../context";

/**
 * A hook used to access values in the store. Must be used within a AnimationProvider. See the AnimationData for the attributes and the AnimationActions for the methods that can be accessed.
 *
 * @param selector - A function that takes the store and returns the value you want to access.
 * @returns The value returned by the selector.
 */
export function useAnimationStore<T>(selector: (state: AnimationData & AnimationActions) => T): T {
  const store = useContext(AnimationContext);
  if (!store) throw new Error("Missing AnimationProvider in the tree");
  return useStore(store, selector);
}
