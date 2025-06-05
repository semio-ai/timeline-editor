import { useRef, useCallback } from "react";
import { MotionValue, useMotionValue } from "motion/react";
import { clamp } from "lodash";
import { useShallow } from "zustand/react/shallow";
import { PlayerData } from "@semio/utils";
import { stampToVisualTime } from "@semio/ui";
import { scaleLinear } from "@visx/scale";
import { shallow } from "zustand/shallow";
import { type ScaleLinear } from "../scale-linear";
import { CARET_HALF_WIDTH } from "../constants";
import { useTrackContext } from "./use-track-context";
import { useAnimationStore } from "./use-animation-store";
import { useAltKeyPressed } from "./use-alt-key-pressed";
import { usePlayerSubscription } from "./use-player-subscription";

// Initialize the parameters so that the cart has the settings of sitting
// at the beginning of the timeline (no padding on left, extra padding on right)
const INITIAL_BUFFER = [0, 1000];

/**
 * A hook used to retrieve a spring that contains the path of the svg path for the playhead cart,
 * given current bounds and position.
 *
 * @param duration - The duration of the timeline (not the track/animation)
 * @param ignoreZoom - Whether to ignore zoom from the viewport
 * @returns The value you want to access.
 */
export function usePlayheadCartSprings(
  duration: number,
  fontSize: number,
  ignoreZoom?: boolean,
): {
  offset: MotionValue<number>;
  width: MotionValue<number>;
  visibility: MotionValue<number>;
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
    // Default to an identity scale. This may change as users zoom in and out.
    scaleLinear({
      domain: [0, 1],
      range: [0, 1],
    }),
  );

  // Initialize buffers with initial values. We disregard the initial path for now.
  const initialOffset = distanceToOffset(
    INITIAL_BUFFER[0],
    INITIAL_BUFFER[1],
    storedCharCount.current * fontSize,
  );

  // Inititialize the motion values, as well as values for the char count (to determine the size of the cart)
  // And the actual cart path, which consumes the buffer values and the char count.
  const leftBuffer = useMotionValue(INITIAL_BUFFER[0]);
  const rightBuffer = useMotionValue(INITIAL_BUFFER[1]);
  const widthSpring = useMotionValue(storedCharCount.current * fontSize);
  const visibilitySpring = useMotionValue(0);

  // const playheadCartPathSpring = useTransform(() =>
  //   distanceToPath(leftBuffer.get(), rightBuffer.get(), storedCharCountSpring.get(), side),
  // );

  // Create a motion value for the x position of the cart.
  const offsetSpring = useMotionValue(initialOffset);

  const altPressed = useAltKeyPressed();

  // A callback that gets called when the playhead time changes.
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
      const offset = distanceToOffset(...bufferVals, charCount * fontSize);
      leftBuffer.jump(bufferVals[0]);
      if (bufferVals[0] < 0) {
        visibilitySpring.jump(-1);
      } else if (bufferVals[1] < 0) {
        visibilitySpring.jump(1);
      } else {
        visibilitySpring.jump(0);
      }
      rightBuffer.jump(bufferVals[1]);
      widthSpring.jump(charCount * fontSize);
      offsetSpring.jump(offset);
      storedCharCount.current = charCount;
    },
    [
      storedPlayhead,
      offsetSpring,
      visibilitySpring,
      xScale,
      zoomScale,
      duration,
      framerate,
      timeDisplay,
      altPressed,
      leftBuffer,
      rightBuffer,
      widthSpring,
      storedCharCount,
      fontSize,
    ],
  );

  // A callback that gets executed when the viewport changes.
  const handleViewportChange = useCallback(
    (viewport: [number, number]) => {
      zoomScale.current = zoomScale.current.domain(ignoreZoom ? [0, 1] : viewport);
      const playhead = storedPlayhead.current;
      const bufferVals = valsToBuffer(xScale, zoomScale.current, playhead, duration);
      const offset = distanceToOffset(...bufferVals, storedCharCount.current * fontSize);
      if (bufferVals[0] < 0) {
        visibilitySpring.jump(-1);
      } else if (bufferVals[1] < 0) {
        visibilitySpring.jump(1);
      } else {
        visibilitySpring.jump(0);
      }
      leftBuffer.jump(bufferVals[0]);
      rightBuffer.jump(bufferVals[1]);
      offsetSpring.jump(offset);
    },
    [
      ignoreZoom,
      xScale,
      fontSize,
      offsetSpring,
      visibilitySpring,
      storedPlayhead,
      leftBuffer,
      rightBuffer,
      storedCharCount,
      duration,
    ],
  );

  // Assign the subscriptions to the player data.
  usePlayerSubscription((state: PlayerData) => state.player.stamp, handlePlayheadChange, shallow);

  usePlayerSubscription(
    (state: PlayerData) => state.player.viewport,
    handleViewportChange,
    shallow,
  );

  return { offset: offsetSpring, width: widthSpring, visibility: visibilitySpring };
}

/**
 * Calculates the buffer values for the playhead position based on the given scales.
 * Outputs values in the pixel space of the timeline
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
 * Calculates the offset point for a flag based on distances and character count.
 *
 * @param distanceLeft - The distance from the left side.
 * @param distanceRight - The distance from the right side.
 * @param charCount - The number of characters in the flag.
 * @returns A value indicating the x-value offset point for the cart.
 */
function distanceToOffset(distanceLeft: number, distanceRight: number, flagWidth: number): number {
  const leftP = -1 * clamp(distanceLeft, 0, flagWidth / 2);
  const rightP = clamp(distanceRight, 0, flagWidth / 2);
  // console.log(leftP, rightP, flagWidth);
  const leftX = Math.min(leftP - CARET_HALF_WIDTH, Math.max(0, distanceRight) - flagWidth);
  const rightX = Math.max(Math.min(0, -1 * distanceLeft) + flagWidth, rightP + CARET_HALF_WIDTH);

  return (leftX + rightX) / 2 - flagWidth / 2;
}
