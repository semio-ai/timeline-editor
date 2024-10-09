import { useContext, useEffect, useRef, useCallback } from "react";
import type { AnimationData, AnimationActions } from "../store-types";
import { AnimationContext } from "../context";

/*
  @name useWithBounds
  @description A hook used to retrieve a function that provides the current bounds to a provided function.
  @returns A function that provides the current bounds to a function argument.
*/
export function useWithBounds(): (withBoundsFn: (bounds: [number, number]) => void) => void {
  const store = useContext(AnimationContext);

  if (!store) {
    throw new Error("useWithBounds must be used within an AnimationProvider");
  }

  const bounds = useRef<[number, number]>(store.getState().player.bounds);

  useEffect(() => {
    const unsubscribe = store.subscribe(
      (state: AnimationData & AnimationActions) => state.player.bounds,
      (currentBounds) => {
        bounds.current = currentBounds;
      },
    );
    return unsubscribe;
  }, [store]);

  const withBounds = useCallback(
    (withBoundsFn: (bounds: [number, number]) => void) => {
      withBoundsFn(bounds.current);
    },
    [bounds],
  );

  return withBounds;
}
