import { useContext, useEffect, useRef, useCallback } from "react";
import { useShallow } from "zustand/react/shallow";
import { SpringValue, useSpringValue } from "@react-spring/web";
import { scaleLinear } from "@visx/scale";
import type { AnimationData, AnimationActions } from "../store-types";
// import { SemanticTime } from "../store-types";
import { AnimationContext } from "../context";
import { defaultScaleLinear, type ScaleLinear } from "../scale-linear";
import { useAnimationStore } from "./use-animation-store";

/*
  @name useAnimationStore
  @description A hook used to access values in the store. Must be used within a AnimationProvider. See the AnimationData for the attributes and the AnimationActions for the methods that can be accessed.

  @param selector A function that takes the store and returns the value you want to access.
*/
export function useZoomedSpring(ignoreZoom?: boolean): {
  setZoom: (start: number, end: number) => void;
  zoomedSpring: SpringValue<number>;
  setValue: (value: number) => void;
  withZoom: (withZoomFn: (zoomScale: ScaleLinear) => void) => void;
} {
  const zoomScale = useRef<ScaleLinear>(defaultScaleLinear);
  const storedValue = useRef<number | undefined>();

  const store = useContext(AnimationContext);

  if (!store) {
    throw new Error("useHoverSpring must be used within an AnimationProvider");
  }

  const updateViewport = useAnimationStore(
    useShallow((state) => state.updatePlayerViewport),
  );
  // const addPreview = store.getState().addPreview;
  // const updatePreview = store.getState().updatePreview;
  // const removePreview = store.getState().removePreview;
  const zoomedSpring = useSpringValue<number>(
    zoomScale.current(storedValue.current || 0),
    {
      config: {
        tension: 400,
        friction: 20,
        clamp: true,
      },
    },
  );

  useEffect(() => {
    const unsubscribe = store.subscribe(
      (state: AnimationData & AnimationActions) => state.player.viewport,
      (viewport) => {
        zoomScale.current = scaleLinear({
          domain: ignoreZoom ? [0, 1] : viewport,
          range: [0, 1],
        });
        if (storedValue.current !== undefined) {
          void zoomedSpring.start(zoomScale.current(storedValue.current));
        } else {
          void zoomedSpring.set(zoomScale.current(0));
        }
      },
    );
    return unsubscribe;
  }, [ignoreZoom, store, zoomedSpring]);

  const setValue = useCallback(
    (value: number) => {
      storedValue.current = value;
      void zoomedSpring.start(zoomScale.current(value));
    },
    [zoomedSpring],
  );

  const withZoom = useCallback(
    (withZoomFn: (zoomScale: ScaleLinear) => void) => {
      withZoomFn(zoomScale.current);
    },
    [zoomScale],
  );

  return { setZoom: updateViewport, zoomedSpring, setValue, withZoom };
}
