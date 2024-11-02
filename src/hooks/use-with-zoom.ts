import { useRef, useCallback } from "react";
import { scaleLinear } from "@visx/scale";
import { shallow } from "zustand/shallow";
import type { AnimationData } from "../store-types";
import { type ScaleLinear } from "../scale-linear";
import { useStoreSubscription } from "./use-store-subscription";

/*
  @name useWithZoom
  @description A hook used to retrieve a function that provides the current zoom scale to a provided function.
  @param ignoreZoom If true, the zoom scale will be ignored.
  @returns A function that provides the current zoom scale to a function argument.
*/
export function useWithZoom(
  ignoreZoom?: boolean,
): (withZoomFn: (zoomScale: ScaleLinear) => void) => void {
  const zoomScale = useRef<ScaleLinear>(
    scaleLinear({
      domain: [0, 1],
      range: [0, 1],
    }),
  );

  const callback = useCallback(
    (viewport: [number, number]) => {
      zoomScale.current = scaleLinear({
        domain: ignoreZoom ? [0, 1] : viewport,
        range: [0, 1],
      });
    },
    [ignoreZoom],
  );

  useStoreSubscription((state: AnimationData) => state.player.viewport, callback, shallow);

  const withZoom = useCallback(
    (withZoomFn: (zoomScale: ScaleLinear) => void) => {
      withZoomFn(zoomScale.current);
    },
    [zoomScale],
  );

  return withZoom;
}
