import { SpringValue, useSpringValue } from "@react-spring/web";
import { shallow } from "zustand/shallow";
import type { AnimationData } from "../store-types";
import { springConfig } from "../spring-config";
import { useStoreSubscription } from "./use-store-subscription";

/**
 * A hook used to retrieve springs representing the left and right bounds of the viewport.
 * @returns An object containing the left and right springs.
 */
export function useZoomSprings(): {
  leftSpring: SpringValue<number>;
  rightSpring: SpringValue<number>;
  widthSpring: SpringValue<number>;
} {
  const leftSpring = useSpringValue<number>(0, {
    config: springConfig,
  });
  const rightSpring = useSpringValue<number>(1, {
    config: springConfig,
  });
  const widthSpring = useSpringValue<number>(1, {
    config: springConfig,
  });

  useStoreSubscription(
    (state: AnimationData) => state.player.viewport,
    (bounds) => {
      void leftSpring.set(bounds[0]);
      void rightSpring.set(bounds[1]);
      void widthSpring.set(bounds[1] - bounds[0]);
    },
    shallow,
  );

  return { leftSpring, rightSpring, widthSpring };
}
