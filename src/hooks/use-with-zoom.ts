import { useContext, useEffect, useRef, useCallback } from "react";
import { scaleLinear } from "@visx/scale";
import type { AnimationData, AnimationActions } from "../store-types";
// import { SemanticTime } from "../store-types";
import { AnimationContext } from "../context";
import { type ScaleLinear } from "../scale-linear";

/*
  @name useWithZoom
  @description A hook used to retrieve a function that provides the current zoom scale to a provided function.
  @param ignoreZoom If true, the zoom scale will be ignored.
  @returns A function that provides the current zoom scale to a function argument.
*/
export function useWithZoom(
  ignoreZoom?: boolean,
): (withZoomFn: (zoomScale: ScaleLinear) => void) => void {
  const store = useContext(AnimationContext);

  if (!store) {
    throw new Error("useWithZoom must be used within an AnimationProvider");
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
