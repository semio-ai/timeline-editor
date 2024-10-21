import { useContext, useEffect, useRef, useCallback } from "react";
import { SpringValue, useSpringValue } from "@react-spring/web";
import { scaleLinear } from "@visx/scale";
import type { AnimationData, AnimationActions } from "../store-types";
import { SemanticTime } from "../store-types";
import { AnimationContext } from "../context";
import { type ScaleLinear } from "../scale-linear";
import { springConfig } from "../spring-config";

/*
  @name useHoverSpring
  @description A hook used to retrieve a spring value and set it in the store. Must be used within a AnimationProvider.
  @param ignoreZoom A boolean that determines if the zoom should be ignored when setting the hoverpoint.
  @returns An object containing the hoverpoint spring, a setter for the hoverpoint, and a function to clear the hoverpoint.
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

  const zoomScale = useRef<ScaleLinear>(
    scaleLinear({
      domain: ignoreZoom ? [0, 1] : store.getState().player.viewport,
      range: [0, 1],
    }),
  );

  const initialHoverpoint = store
    ?.getState()
    .previews.find((p) => p.semanticTime === SemanticTime.Hover)?.stamp;

  const storedHoverpoint = useRef<number | undefined>(initialHoverpoint);

  const hoverpointSpring = useSpringValue<number | undefined>(
    storedHoverpoint.current ? zoomScale.current(storedHoverpoint.current) : undefined,
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
        state.previews.find((p) => p.semanticTime === SemanticTime.Hover)?.stamp,
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
    if (store.getState().previews.find((p) => p.semanticTime === SemanticTime.Hover)) {
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
