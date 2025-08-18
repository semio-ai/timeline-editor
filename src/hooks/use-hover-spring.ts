import { MotionValue, useMotionValue } from "motion/react";
import { shallow } from "zustand/shallow";
import type { AnimationData } from "../store-types";
import { SemanticTime } from "../types";
import { useStoreSubscription } from "./use-store-subscription";

/**
 * A hook used to retrieve a spring value and set it in the store. Must be used within a AnimationProvider.
 * @returns An object containing the hoverpoint spring, a setter for the hoverpoint, and a function to clear the hoverpoint.
 */
export function useHoverSpring(): MotionValue<number | undefined> {
  const hoverpointSpring = useMotionValue<number | undefined>(undefined);

  useStoreSubscription(
    (state: AnimationData) =>
      state.previews.find((p) => p.semanticTime === SemanticTime.Hover)?.stamp,
    (hoverpoint: number | undefined) => {
      if (hoverpoint !== undefined) {
        hoverpointSpring.jump(hoverpoint);
      } else {
        hoverpointSpring.jump(undefined);
      }
    },
    shallow,
  );

  return hoverpointSpring;
}
