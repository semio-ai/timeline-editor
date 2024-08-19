import { useContext, useEffect, useRef, useCallback } from "react";
import { SpringValue, useSpringValue } from "@react-spring/web";
import { scaleLinear } from "@visx/scale";
import type { AnimationData, AnimationActions } from "../store-types";
import { SemanticTime } from "../store-types";
import { AnimationContext } from "../context";
import { type ScaleLinear } from "../scale-linear";
import { springConfig } from "../spring-config";

/*
  @name useAnimationStore
  @description A hook used to access values in the store. Must be used within a AnimationProvider. See the AnimationData for the attributes and the AnimationActions for the methods that can be accessed.

  @param selector A function that takes the store and returns the value you want to access.
*/
export function useHoverSpring(ignoreZoom?: boolean): {
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

  const storedHoverpoint = useRef<number | undefined>(
    store!
      .getState()
      .previews.find((p) => p.semanticTime === SemanticTime.Hover)?.stamp,
  );

  const zoomScale = useRef<ScaleLinear>(
    scaleLinear({
      domain: ignoreZoom ? [0, 1] : store.getState().player.viewport,
      range: [0, 1],
    }),
  );

  const initialHoverpoint = store
    ?.getState()
    .previews.find((p) => p.semanticTime === SemanticTime.Hover)?.stamp;

  const hoverpointSpring = useSpringValue<number | undefined>(
    initialHoverpoint ? zoomScale.current(initialHoverpoint) : undefined,
    {
      config: springConfig,
    },
  );

  const onViewportChange = useCallback(
    (viewport: [number, number]) => {
      const scale = scaleLinear({
        domain: viewport,
        range: [0, 1],
      });
      zoomScale.current = scale;
      if (storedHoverpoint.current) {
        void hoverpointSpring.start(scale(storedHoverpoint.current));
      } else {
        void hoverpointSpring.set(undefined);
      }
    },
    [hoverpointSpring, zoomScale],
  );

  useEffect(() => {
    const unsubscribe = store.subscribe(
      (state: AnimationData & AnimationActions) =>
        state.previews.find((p) => p.semanticTime === SemanticTime.Hover)
          ?.stamp,
      (hoverpoint, pastHoverpoint) => {
        if (pastHoverpoint === undefined && hoverpoint !== undefined) {
          void hoverpointSpring.set(zoomScale.current(hoverpoint));
          storedHoverpoint.current = hoverpoint;
        } else if (hoverpoint !== undefined) {
          void hoverpointSpring.start(zoomScale.current(hoverpoint));
          storedHoverpoint.current = hoverpoint;
        } else {
          void hoverpointSpring.set(undefined);
          storedHoverpoint.current = hoverpoint;
        }
      },
    );
    return unsubscribe;
  });
  useEffect(() => {
    if (ignoreZoom) {
      const scale = scaleLinear({
        domain: [0, 1],
        range: [0, 1],
      });
      zoomScale.current = scale;
      if (storedHoverpoint.current) {
        void hoverpointSpring.start(storedHoverpoint.current);
      }

      return () => {};
    } else {
      const unsubscribe = store.subscribe(
        (state: AnimationData) => state.player.viewport,
        onViewportChange,
      );

      onViewportChange(store.getState().player.viewport);

      return unsubscribe;
    }
  }, [ignoreZoom, store, onViewportChange, hoverpointSpring]);

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
