import { useContext, useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { SpringValue, useSpringValue } from "@react-spring/web";
import type { AnimationData } from "../store-types";
// import { SemanticTime } from "../store-types";
import { AnimationContext } from "../context";
import { useAnimationStore } from "./use-animation-store";

/*
  @name useAnimationStore
  @description A hook used to access values in the store. Must be used within a AnimationProvider. See the AnimationData for the attributes and the AnimationActions for the methods that can be accessed.

  @param selector A function that takes the store and returns the value you want to access.
*/
export function useZoomSprings(): {
  setZoom: (start: number, end: number) => void;
  leftSpring: SpringValue<number>;
  rightSpring: SpringValue<number>;
} {
  // const storedValue = useRef<number | undefined>();

  const store = useContext(AnimationContext);

  if (!store) {
    throw new Error("useHoverSpring must be used within an AnimationProvider");
  }

  const leftSpring = useSpringValue<number>(
    store.getState().player.viewport[0],
    {
      config: {
        tension: 400,
        friction: 20,
        clamp: true,
      },
    },
  );
  const rightSpring = useSpringValue<number>(
    store.getState().player.viewport[1],
    {
      config: {
        tension: 400,
        friction: 20,
        clamp: true,
      },
    },
  );

  const updateViewport = useAnimationStore(
    useShallow((state) => state.updatePlayerViewport),
  );

  useEffect(() => {
    const unsubscribe = store.subscribe(
      (state: AnimationData) => state.player.viewport,
      (bounds) => {
        void leftSpring.set(bounds[0]);
        void rightSpring.set(bounds[1]);
      },
    );
    return unsubscribe;
  }, [store, leftSpring, rightSpring]);

  return { setZoom: updateViewport, leftSpring, rightSpring };
}
