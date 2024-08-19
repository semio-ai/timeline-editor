import { useContext, useEffect, useRef, useCallback } from "react";
import { scaleLinear } from "@visx/scale";
import type { AnimationData, AnimationActions } from "../store-types";
// import { SemanticTime } from "../store-types";
import { AnimationContext } from "../context";
import { type ScaleLinear } from "../scale-linear";

/*
  @name useAnimationStore
  @description A hook used to access values in the store. Must be used within a AnimationProvider. See the AnimationData for the attributes and the AnimationActions for the methods that can be accessed.

  @param selector A function that takes the store and returns the value you want to access.
*/
export function useWithZoom(
  ignoreZoom?: boolean,
): (withZoomFn: (zoomScale: ScaleLinear) => void) => void {
  const store = useContext(AnimationContext);

  if (!store) {
    throw new Error("useHoverSpring must be used within an AnimationProvider");
  }

  const zoomScale = useRef<ScaleLinear>(
    scaleLinear({
      domain: ignoreZoom ? [0, 1] : store.getState().player.viewport,
      range: [0, 1],
    }),
  );

  useEffect(() => {
    const unsubscribe = store.subscribe(
      (state: AnimationData & AnimationActions) => state.player.viewport,
      (viewport) => {
        zoomScale.current = scaleLinear({
          domain: ignoreZoom ? [0, 1] : viewport,
          range: [0, 1],
        });
      },
    );
    return unsubscribe;
  }, [ignoreZoom, store]);

  const withZoom = useCallback(
    (withZoomFn: (zoomScale: ScaleLinear) => void) => {
      withZoomFn(zoomScale.current);
    },
    [zoomScale],
  );

  return withZoom;
}
