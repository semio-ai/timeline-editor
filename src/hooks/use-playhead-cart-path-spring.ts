import { useContext, useEffect, useRef, useMemo, useCallback } from "react";
import { SpringValue, useSpringValue } from "@react-spring/web";
import { useShallow } from "zustand/react/shallow";
import { pointsToPath } from "@semio/utils";
import { stampToVisualTime } from "@semio/ui";
import { scaleLinear } from "@visx/scale";
import type { AnimationData } from "../store-types";
import { AnimationContext } from "../context";
import { type ScaleLinear } from "../scale-linear";
import { springConfig } from "../spring-config";
import { useTrackContext } from "./use-track-context";
import { useAnimationStore } from "./use-animation-store";
import { useAltKeyPressed } from "./use-alt-key-pressed";

/*
  @name usePlayheadCartPathSpring
  @description A hook used to retrieve a spring that contains the path of the svg path for the playhead cart, given current bounds and position.

  @param selector A function that takes the store and returns the value you want to access.
*/
export function usePlayheadCartPathSpring(
  side: "top" | "bottom",
  ignoreZoom?: boolean,
): {
  d: SpringValue<string>;
  x: SpringValue<number>;
} {
  const store = useContext(AnimationContext);

  if (!store) {
    throw new Error("useHoverSpring must be used within a StudioProvider");
  }

  const storedPlayhead = useRef<number>(store!.getState().player.stamp);

  const { duration, framerate, timeDisplay } = useAnimationStore(
    useShallow((state) => ({
      duration: state.animations[state.activeAnimation].duration,
      framerate: state.framerate,
      timeDisplay: state.timeDisplay,
    })),
  );
  const storedCharCount = useRef<number>(
    stampToVisualTime(storedPlayhead.current, duration, framerate, timeDisplay).length,
  );

  const { scale: xScale } = useTrackContext();

  const zoomScale = useRef<ScaleLinear>(
    scaleLinear({
      domain: ignoreZoom ? [0, 1] : store.getState().player.viewport,
      range: [0, 1],
    }),
  );

  const [initialPath, initialX] = useMemo(() => {
    return distanceToPath(0, 200, storedCharCount.current, side);
  }, [side]);

  const playheadCartPathSpring = useSpringValue<string>(initialPath, {
    config: {
      tension: 180,
      friction: 12,
      clamp: true,
    },
  });

  const xSpring = useSpringValue<number>(initialX, {
    config: springConfig,
  });

  const altPressed = useAltKeyPressed();

  const handlePlayheadChange = useCallback(
    (playhead: number) => {
      storedPlayhead.current = playhead;
      const bufferVals = valsToBuffer(xScale, zoomScale.current, playhead);
      const charCount = stampToVisualTime(
        playhead,
        duration,
        framerate,
        timeDisplay,
        altPressed,
      ).length;
      const [path, offset] = distanceToPath(...bufferVals, charCount, side);
      void playheadCartPathSpring.start(path);
      void xSpring.start(offset);
      storedCharCount.current = charCount;
    },
    [
      storedPlayhead,
      xSpring,
      playheadCartPathSpring,
      xScale,
      zoomScale,
      duration,
      framerate,
      timeDisplay,
      altPressed,
      side,
    ],
  );

  const handleViewportChange = useCallback(
    (viewport: [number, number]) => {
      zoomScale.current = scaleLinear({
        domain: ignoreZoom ? [0, 1] : viewport,
        range: [0, 1],
      });
      const playhead = storedPlayhead.current;
      const bufferVals = valsToBuffer(xScale, zoomScale.current, playhead);
      const [path, offset] = distanceToPath(...bufferVals, storedCharCount.current, side);
      void playheadCartPathSpring.start(path);
      void xSpring.start(offset);
    },
    [ignoreZoom, xScale, playheadCartPathSpring, xSpring, storedPlayhead, side],
  );

  useEffect(() => {
    const unsubscribe = store.subscribe(
      (state: AnimationData) => state.player.stamp,
      handlePlayheadChange,
    );
    handlePlayheadChange(store.getState().player.stamp);
    return unsubscribe;
  });
  useEffect(() => {
    const unsubscribe = store.subscribe(
      (state: AnimationData) => state.player.viewport,
      handleViewportChange,
    );
    handleViewportChange(store.getState().player.viewport);
    return unsubscribe;
  });

  return { d: playheadCartPathSpring, x: xSpring };
}

const valsToBuffer = (
  xScale: ScaleLinear,
  zoomScale: ScaleLinear,
  playhead: number,
): [number, number] => {
  const xrange = xScale.range();
  const scaledPlayhead = xScale(zoomScale(playhead));
  const zoomed: [number, number] = [scaledPlayhead - xrange[0], xrange[1] - scaledPlayhead];
  return zoomed;
};

const corner = scaleLinear({
  domain: [-4, 0],
  range: [3.5, 0],
  clamp: true,
});

function distanceToPath(
  distanceLeft: number,
  distanceRight: number,
  charCount: number,
  side: "top" | "bottom",
): [string, number] {
  const flagWidth = charCount * 8;
  const boundScale = scaleLinear({
    domain: [0, flagWidth / 2],
    range: [0, flagWidth / 2],
    clamp: true,
  });
  // These are ordered clockwise around the shape
  const leftP = -1 * boundScale(distanceLeft);
  const rightP = boundScale(distanceRight);
  const offscreenL = corner(distanceLeft);
  const offscreenR = corner(distanceRight);

  const leftX = Math.min(leftP - 6, Math.max(0, distanceRight) - flagWidth);
  const rightX = Math.max(Math.min(0, -1 * distanceLeft) + flagWidth, rightP + 6);

  const pTLC: [number, number] = [leftX, 3.5 + offscreenL + VERTICAL_BUFFER];
  const pTLT: [number, number] = [-6, 3.5 + offscreenL + VERTICAL_BUFFER];
  const pTCTl: [number, number] = [
    -0.5,
    (side === "top" ? 3.5 : 0 + Math.max(offscreenL, offscreenR)) + VERTICAL_BUFFER,
  ];
  const pTCTr: [number, number] = [
    0.5,
    (side === "top" ? 3.5 : 0 + Math.max(offscreenL, offscreenR)) + VERTICAL_BUFFER,
  ];
  const pTRT: [number, number] = [+6, 3.5 + offscreenR + VERTICAL_BUFFER];
  const pTRC: [number, number] = [rightX, 3.5 + offscreenR + VERTICAL_BUFFER];

  const pBRC: [number, number] = [rightX, 24 - offscreenR - VERTICAL_BUFFER];
  const pBRT: [number, number] = [+6, 24 - offscreenR - VERTICAL_BUFFER];
  const pBCTr: [number, number] = [
    0.5,
    (side === "bottom" ? 24 : 27.5 - Math.max(offscreenL, offscreenR)) - VERTICAL_BUFFER,
  ];
  const pBCTl: [number, number] = [
    -0.5,
    (side === "bottom" ? 24 : 27.5 - Math.max(offscreenL, offscreenR)) - VERTICAL_BUFFER,
  ];
  const pBLT: [number, number] = [-6, 24 - offscreenL - VERTICAL_BUFFER];
  const pBLC: [number, number] = [leftX, 24 - offscreenL - VERTICAL_BUFFER];

  const points = [pTLC, pTLT, pTCTl, pTCTr, pTRT, pTRC, pBRC, pBRT, pBCTr, pBCTl, pBLT, pBLC];
  const path = pointsToPath(points, true);
  return [path, (leftX + rightX) / 2] as [string, number];
}

const VERTICAL_BUFFER = 1.5;
