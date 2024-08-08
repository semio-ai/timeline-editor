import { useContext, useEffect } from "react";
import { SpringValue } from "@react-spring/web";
import type { AnimationData, AnimationActions } from "../store-types";
import { SemanticTime } from "../store-types";
import { AnimationContext } from "../context";

/*
  @name useAnimationStore
  @description A hook used to access values in the store. Must be used within a AnimationProvider. See the AnimationData for the attributes and the AnimationActions for the methods that can be accessed.

  @param selector A function that takes the store and returns the value you want to access.
*/
export function useHoverSpring(): {
  setHoverpoint: (value: number) => void;
  clearHoverpoint: () => void;
  hoverpoint: SpringValue<number | undefined>;
} {
  const store = useContext(AnimationContext);
  if (!store) {
    throw new Error("useHoverSpring must be used within a StudioProvider");
  }
  const addPreview = store.getState().addPreview;
  const updatePreview = store.getState().updatePreview;
  const removePreview = store.getState().removePreview;

  const hoverpointSpring = new SpringValue<number | undefined>(
    store!
      .getState()
      .previews.find((p) => p.semanticTime === SemanticTime.Hover)?.stamp,
    {
      config: { duration: 0 },
    },
  );
  useEffect(() => {
    const unsubscribe = store.subscribe(
      (state: AnimationData & AnimationActions) =>
        state.previews.find((p) => p.semanticTime === SemanticTime.Hover)
          ?.stamp,
      (hoverpoint) => {
        hoverpointSpring.set(hoverpoint);
      },
    );
    return unsubscribe;
  });
  const setHoverpoint = (value: number) => {
    if (
      store
        .getState()
        .previews.find((p) => p.semanticTime === SemanticTime.Hover)
    ) {
      updatePreview((preview) => preview.semanticTime === SemanticTime.Hover, {
        stamp: value,
      });
    } else {
      addPreview({
        stamp: value,
        label: "Hoverpoint",
        semanticTime: SemanticTime.Hover,
      });
    }
  };
  const clearHoverpoint = () => {
    removePreview((preview) => preview.semanticTime === SemanticTime.Hover);
  };

  return { setHoverpoint, hoverpoint: hoverpointSpring, clearHoverpoint };
}
