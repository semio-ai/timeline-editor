import { useContext, useEffect } from "react";
import { SpringValue } from "@react-spring/web";
import type { AnimationData, AnimationActions } from "../store-types";
import { AnimationContext } from "../context";

/*
  @name useAnimationStore
  @description A hook used to access values in the store. Must be used within a AnimationProvider. See the AnimationData for the attributes and the AnimationActions for the methods that can be accessed.

  @param selector A function that takes the store and returns the value you want to access.
*/
export function useHoverSpring(): {
  setHoverpoint: (value: number) => void;
  hoverpoint: SpringValue;
} {
  const store = useContext(AnimationContext);
  if (!store) {
    throw new Error("useHoverSpring must be used within a StudioProvider");
  }
  const hoverpointSpring = new SpringValue(store!.getState().hoverpoint, {
    config: { duration: 0 },
  });
  useEffect(() => {
    const unsubscribe = store.subscribe(
      (state: AnimationData & AnimationActions) => state.hoverpoint,
      (hoverpoint) => {
        hoverpointSpring.set(hoverpoint);
      },
    );
    return unsubscribe;
  });
  const setHoverpoint = (value: number) => {
    store.setState({ hoverpoint: value });
  };

  return { setHoverpoint, hoverpoint: hoverpointSpring };
}
