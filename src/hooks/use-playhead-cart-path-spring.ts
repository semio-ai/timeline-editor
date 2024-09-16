import { useContext, useEffect, useRef } from "react";
import { SpringValue, useSpringValue } from "@react-spring/web";
import { pointsToPath } from "@semio/utils";
import { scaleLinear } from "@visx/scale";
import type { AnimationData } from "../store-types";
import { FLAG_WIDTH, TIMELINE_PADDING } from "../constants";
import { AnimationContext } from "../context";
import { type ScaleLinear } from "../scale-linear";
import { springConfig } from "../spring-config";
import { useTrackBounds } from "./use-track-bounds";

/*
  @name usePlayheadCartPathSpring
  @description A hook used to retrieve a spring that contains the path of the svg path for the playhead cart, given current bounds and position.

  @param selector A function that takes the store and returns the value you want to access.
*/
export function usePlayheadCartPathSpring(ignoreZoom?: boolean): {
  d: SpringValue<string>;
  x: SpringValue<number>;
} {
  const store = useContext(AnimationContext);

  if (!store) {
    throw new Error("useHoverSpring must be used within a StudioProvider");
  }

  const storedPlayhead = useRef<number>(store!.getState().player.stamp);
  const storedViewport = useRef<[number, number]>(
    store.getState().player.viewport,
  );
  // console.log("vp", storedViewport.current);
  // console.log("ph", storedPlayhead.current);

  const { scale: xScale } = useTrackBounds();

  const zoomScale = useRef<ScaleLinear>(
    scaleLinear({
      domain: ignoreZoom ? [0, 1] : storedViewport.current,
      range: [0, 1],
    }),
  );

  const [initialPath, initialX] = distanceToPath(TIMELINE_PADDING, 200);

  const playheadCartPathSpring = useSpringValue<string>(initialPath, {
    config: springConfig,
  });

  const xSpring = useSpringValue<number>(initialX, {
    config: springConfig,
  });

  useEffect(() => {
    const unsubscribe = store.subscribe(
      (state: AnimationData) => state.player.stamp,
      (playhead) => {
        storedPlayhead.current = playhead;
        const bufferVals = valsToBuffer(
          xScale,
          zoomScale.current,
          storedViewport.current,
          playhead,
          ignoreZoom ?? false,
        );
        // buffer.current = bufferVals;
        const [path, x] = distanceToPath(...bufferVals);
        void playheadCartPathSpring.start(path);
        void xSpring.start(x);
      },
    );
    return unsubscribe;
  });
  useEffect(() => {
    const unsubscribe = store.subscribe(
      (state: AnimationData) => state.player.viewport,
      (viewport) => {
        zoomScale.current = scaleLinear({
          domain: ignoreZoom ? [0, 1] : viewport,
          range: [0, 1],
        });
        const playhead = storedPlayhead.current;
        storedViewport.current = viewport;
        const bufferVals = valsToBuffer(
          xScale,
          zoomScale.current,
          viewport,
          playhead,
          ignoreZoom ?? false,
        );
        // buffer.current = bufferVals;
        const [path, x] = distanceToPath(...bufferVals);
        void playheadCartPathSpring.start(path);
        void xSpring.start(x);
      },
    );
    return unsubscribe;
  });

  return { d: playheadCartPathSpring, x: xSpring };
}

const valsToBuffer = (
  xScale: ScaleLinear,
  zoomScale: ScaleLinear,
  viewport: [number, number],
  playhead: number,
  ignoreZoom: boolean,
): [number, number] => {
  if (ignoreZoom) {
    const ignoredZoom: [number, number] = [
      xScale(zoomScale(playhead)) - TIMELINE_PADDING,
      xScale(zoomScale(1 - playhead)) - TIMELINE_PADDING,
    ];
    // console.log("ignore zoom", ignoredZoom);
    return ignoredZoom;
  } else {
    const zoomed: [number, number] = [
      xScale(zoomScale(playhead)) -
        xScale(zoomScale(viewport[0])) -
        TIMELINE_PADDING,
      xScale(zoomScale(viewport[1])) -
        xScale(zoomScale(playhead)) -
        TIMELINE_PADDING,
    ];
    // console.log("zoom", zoomed);
    return zoomed;
  }
};

const boundScale = scaleLinear({
  domain: [0, FLAG_WIDTH],
  range: [6, FLAG_WIDTH],
  clamp: true,
});

const corner = scaleLinear({
  domain: [-4, 0],
  range: [3.5, 0],
  clamp: true,
});

function distanceToPath(
  distanceLeft: number,
  distanceRight: number,
): [string, number] {
  // These are ordered clockwise around the shape
  const leftP = -1 * boundScale(distanceLeft);
  const rightP = boundScale(distanceRight);
  const offscreenL = corner(distanceLeft);
  const offscreenR = corner(distanceRight);

  const pTLC: [number, number] = [
    Math.max(leftP, rightP - FLAG_WIDTH - 6),
    3.5 + 3.5 * offscreenL,
  ];
  const pTLT: [number, number] = [-6, 3.5 + offscreenL];
  const pTCT: [number, number] = [0, 0 + Math.max(offscreenL, offscreenR)];
  const pTRT: [number, number] = [+6, 3.5 + offscreenR];
  const pTRC: [number, number] = [rightP, 3.5 + offscreenR];

  const pBRC: [number, number] = [rightP, 24 - offscreenR];
  const pBRT: [number, number] = [+6, 24 - offscreenR];
  const pBCT: [number, number] = [0, 27.5 - Math.max(offscreenL, offscreenR)];
  const pBLT: [number, number] = [-6, 24 - offscreenL];
  const pBLC: [number, number] = [
    Math.max(leftP, rightP - FLAG_WIDTH - 6),
    24 - 3.5 * offscreenL,
  ];

  const path = pointsToPath(
    [pTLC, pTLT, pTCT, pTRT, pTRC, pBRC, pBRT, pBCT, pBLT, pBLC],
    true,
  );
  return [path, pTLC[0] + 8.5] as [string, number];
}
