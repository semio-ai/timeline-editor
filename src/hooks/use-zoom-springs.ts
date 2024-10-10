import { useContext, useEffect } from "react";
import { SpringValue, useSpringValue } from "@react-spring/web";
import type { AnimationData } from "../store-types";
import { springConfig } from "../spring-config";
import { AnimationContext } from "../context";

/*
  @name useZoomSprings
  @description A hook used to retrieve springs representing the left and right bounds of the viewport.
  @returns An object containing the left and right springs.
*/
export function useZoomSprings(): {
  leftSpring: SpringValue<number>;
  rightSpring: SpringValue<number>;
  widthSpring: SpringValue<number>;
} {
  const store = useContext(AnimationContext);

  if (!store) {
    throw new Error("useHoverSpring must be used within an AnimationProvider");
  }

  const leftSpring = useSpringValue<number>(store.getState().player.viewport[0], {
    config: springConfig,
  });
  const rightSpring = useSpringValue<number>(store.getState().player.viewport[1], {
    config: springConfig,
  });
  const widthSpring = useSpringValue<number>(
    store.getState().player.viewport[1] - store.getState().player.viewport[0],
    {
      config: springConfig,
    },
  );

  useEffect(() => {
    const unsubscribe = store.subscribe(
      (state: AnimationData) => state.player.viewport,
      (bounds) => {
        void leftSpring.set(bounds[0]);
        void rightSpring.set(bounds[1]);
        void widthSpring.set(bounds[1] - bounds[0]);
      },
    );
    return unsubscribe;
  }, [store, leftSpring, rightSpring, widthSpring]);

  return { leftSpring, rightSpring, widthSpring };
}
