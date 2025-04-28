import { useRef, useMemo, useCallback } from "react";
import { MotionValue, useMotionValue, useTransform } from "motion/react";
import { useShallow } from "zustand/react/shallow";
import { PlayerData, pointsToPath } from "@semio/utils";
import { stampToVisualTime } from "@semio/ui";
import { scaleLinear } from "@visx/scale";
import { shallow } from "zustand/shallow";
import { type ScaleLinear } from "../scale-linear";
import { useTrackContext } from "./use-track-context";
import { useAnimationStore } from "./use-animation-store";
import { useAltKeyPressed } from "./use-alt-key-pressed";
import { usePlayerSubscription } from "./use-player-subscription";

/**
 * A hook used to retrieve a spring that contains the path of the svg path for the playhead cart, given current bounds and position.
 *
 * @param selector - A function that takes the store and returns the value you want to access.
 * @returns The value you want to access.
 */
export function usePlayheadCartPathSpring(
  side: "top" | "bottom",
  duration: number,
  ignoreZoom?: boolean,
): {
  d: MotionValue<string>;
  x: MotionValue<number>;
} {
  const storedPlayhead = useRef<number>(0);

  const { framerate, timeDisplay } = useAnimationStore(
    useShallow((state) => ({
      framerate: state.framerate,
      timeDisplay: state.timeDisplay,
    })),
  );
  const storedCharCount = useRef<number>(
    stampToVisualTime(storedPlayhead.current, duration, framerate, timeDisplay).length,
  );

  const { xScale } = useTrackContext();

  const zoomScale = useRef<ScaleLinear>(
    scaleLinear({
      domain: [0, 1],
      range: [0, 1],
    }),
  );

  const [_initialPath, initialX] = useMemo(() => {
    return distanceToPath(0, 200, storedCharCount.current, side);
  }, [side]);

  const leftBuffer = useMotionValue(0);
  const rightBuffer = useMotionValue(1000);
  const storedCharCountSpring = useMotionValue(storedCharCount.current);

  const playheadCartPathSpring = useTransform(
    () => distanceToPath(leftBuffer.get(), rightBuffer.get(), storedCharCountSpring.get(), side)[0],
  );

  const xSpring = useMotionValue(initialX);

  const altPressed = useAltKeyPressed();

  const handlePlayheadChange = useCallback(
    (playhead: number) => {
      storedPlayhead.current = playhead;
      const bufferVals = valsToBuffer(xScale, zoomScale.current, playhead, duration);
      const charCount = stampToVisualTime(
        playhead,
        duration,
        framerate,
        timeDisplay,
        altPressed,
      ).length;
      const [_path, offset] = distanceToPath(...bufferVals, charCount, side);
      leftBuffer.jump(bufferVals[0]);
      rightBuffer.jump(bufferVals[1]);
      storedCharCountSpring.jump(charCount);
      xSpring.jump(offset);
      storedCharCount.current = charCount;
    },
    [
      storedPlayhead,
      xSpring,
      xScale,
      zoomScale,
      duration,
      framerate,
      timeDisplay,
      altPressed,
      side,
      leftBuffer,
      rightBuffer,
      storedCharCountSpring,
      storedCharCount,
    ],
  );

  const handleViewportChange = useCallback(
    (viewport: [number, number]) => {
      zoomScale.current = zoomScale.current.domain(ignoreZoom ? [0, 1] : viewport);
      const playhead = storedPlayhead.current;
      const bufferVals = valsToBuffer(xScale, zoomScale.current, playhead, duration);
      const [_path, offset] = distanceToPath(...bufferVals, storedCharCount.current, side);
      leftBuffer.jump(bufferVals[0]);
      rightBuffer.jump(bufferVals[1]);
      xSpring.jump(offset);
    },
    [
      ignoreZoom,
      xScale,
      xSpring,
      storedPlayhead,
      side,
      leftBuffer,
      rightBuffer,
      storedCharCount,
      duration,
    ],
  );

  usePlayerSubscription((state: PlayerData) => state.player.stamp, handlePlayheadChange, shallow);

  usePlayerSubscription(
    (state: PlayerData) => state.player.viewport,
    handleViewportChange,
    shallow,
  );

  return { d: playheadCartPathSpring, x: xSpring };
}

/**
 * Calculates the buffer values for the playhead position based on the given scales.
 *
 * @param xScale - A linear scale function for the x-axis.
 * @param zoomScale - A linear scale function for the zoom level.
 * @param playhead - The current position of the playhead.
 * @returns A tuple containing the buffer values [leftBuffer, rightBuffer].
 */
const valsToBuffer = (
  xScale: ScaleLinear,
  zoomScale: ScaleLinear,
  playhead: number,
  duration: number,
): [number, number] => {
  const bounds = zoomScale.domain();
  const scaledPlayhead = xScale(playhead * duration);
  const leftPos = xScale(bounds[0] * duration);
  const rightPos = xScale(bounds[1] * duration);
  const zoomed: [number, number] = [scaledPlayhead - leftPos, rightPos - scaledPlayhead];
  return zoomed;
};

/**
 * A linear scale function that maps a domain of [-4, 0] to a range of [3.5, 0].
 * The output values are clamped to the specified range.
 *
 * @param value - The input value to be scaled.
 * @returns - The scaled value within the range [3.5, 0].
 */
const corner = scaleLinear({
  domain: [-4, 0],
  range: [3.5, 0],
  clamp: true,
});

/**
 * Calculates the path and center point for a flag based on distances and character count.
 *
 * @param distanceLeft - The distance from the left side.
 * @param distanceRight - The distance from the right side.
 * @param charCount - The number of characters in the flag.
 * @param side - The side of the flag, either "top" or "bottom".
 * @returns A tuple containing the SVG path string and the center point.
 */
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
