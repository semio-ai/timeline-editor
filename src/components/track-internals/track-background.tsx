import { memo, useRef, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { motion, useTransform } from "motion/react";
import { usePlayerStore } from "@semio/utils";
import { clsx } from "clsx";
import {
  useAnimationStore,
  useTrackContext,
  useBoundSprings,
  useTrackTransformSpring,
  useScaleInverseSpring,
  useColors,
} from "../../hooks";
import { AnimationData } from "../../store-types";
import { TIMELINE_PADDING } from "../../constants";

export interface TrackBackgroundProps {
  showTicks?: boolean;
  showBackground?: boolean;
  ignoreZoom?: boolean;
  tickHeight?: number;
}

function InnerTrackBackground({
  showTicks = true,
  showBackground = true,
  ignoreZoom = false,
  tickHeight = 210,
}: TrackBackgroundProps) {
  const {
    trackIds,
    attribute,
    bounds: { width, height },
  } = useTrackContext();

  const color = useColors(trackIds);

  const trackSet = trackIds === undefined || trackIds.length === 0 ? ["empty"] : trackIds;

  const identifier = `${trackSet.join("-")}${attribute ? `-${attribute}` : "-all"}`;

  const { leftSpring, widthSpring } = useBoundSprings(ignoreZoom);

  const inverseScaleSpring = useScaleInverseSpring(ignoreZoom);

  const majorTickSpring = useTransform(inverseScaleSpring, (scale) => scale * 2);
  const minorTickSpring = useTransform(inverseScaleSpring, (scale) => scale);

  return (
    <>
      <defs>
        {/* Create a bounds mask that can be used elsewhere */}
        <mask id="boundsMask" width={width + TIMELINE_PADDING * 2} height={height}>
          {/* A full-width spanning element at a 50% color */}
          <motion.rect
            key={`${identifier}-linebg`}
            x={0}
            width={width + TIMELINE_PADDING * 2}
            height={height}
            y={0}
            className="fill-neutral-500 pointer-events-none"
          />
          {/* A full-opacity (white) region of the mask for the active region */}
          <motion.rect
            x={leftSpring}
            y={0}
            width={widthSpring}
            height={height}
            className="fill-white pointer-events-none"
          />
        </mask>

        <pattern id="diagonalStripePattern" patternUnits="userSpaceOnUse" width="20" height="10">
          <rect x="0" y="0" width="20" height="10" className="fill-neutral-500" />
          <line
            x1="5"
            y1="10"
            x2="15"
            y2="0"
            className="stroke-neutral-300"
            strokeWidth="4"
            strokeLinecap="square"
            strokeLinejoin="miter"
          />
          <line
            x1="-5"
            y1="10"
            x2="5"
            y2="0"
            className="stroke-neutral-300"
            strokeWidth="4"
            strokeLinecap="square"
            strokeLinejoin="miter"
          />
          <line
            x1="15"
            y1="10"
            x2="25"
            y2="0"
            className="stroke-neutral-300"
            strokeWidth="4"
            strokeLinecap="square"
            strokeLinejoin="miter"
          />
        </pattern>
        <pattern id="verticalStripePattern" patternUnits="userSpaceOnUse" width="10" height="10">
          <rect x="0" y="0" width="10" height="10" className="fill-black" />
          <line
            x1="5"
            y1="0"
            x2="5"
            y2="10"
            className="stroke-white"
            strokeWidth="4"
            strokeLinecap="square"
            strokeLinejoin="miter"
          />
        </pattern>
        <mask id="diagonalStripe" className="h-full" width={width}>
          <rect
            x={0}
            width={width + TIMELINE_PADDING * 2}
            className="fill-[url(#diagonalStripePattern)]"
            height="100%"
          />
        </mask>
        <mask id="verticalStripe" className="h-full" width={width}>
          <rect
            x={0}
            width={width + TIMELINE_PADDING * 2}
            className="fill-[url(#verticalStripePattern)]"
            height="100%"
          />
        </mask>
      </defs>

      {/* Show the ticks */}
      {showTicks && (
        <TickRegion
          ignoreZoom={ignoreZoom}
          tickHeight={tickHeight}
          majorTickSpring={majorTickSpring}
          minorTickSpring={minorTickSpring}
        />
      )}

      {/* Show the colored background (if necessary) */}
      {showBackground && (
        <>
          <motion.rect
            name="track-active-background"
            x={leftSpring}
            y={0}
            width={widthSpring}
            fill={color}
            opacity={0.2}
            height={height}
            className={clsx("transition-[fill] duration-75", "pointer-events-none")}
          />
          <motion.rect
            name="track-colored-background"
            width={width + TIMELINE_PADDING * 2}
            fill={color}
            height={height - 0.5}
            className={clsx(
              "transition-[fill] duration-75",
              "translate-y-[0.5px]",
              "group-hover/track:opacity-15 group-data-[highlighted]:opacity-15 opacity-0",
              "pointer-events-none",
            )}
          />
        </>
      )}
    </>
  );
}

function TickRegion({
  ignoreZoom,
  tickHeight,
  majorTickSpring,
  minorTickSpring,
}: {
  ignoreZoom: boolean;
  tickHeight: number;
  majorTickSpring: any;
  minorTickSpring: any;
}) {
  const { xScale } = useTrackContext();
  const tickRef = useRef<SVGGElement>(null);
  const framerate = useAnimationStore(
    useShallow((state: AnimationData) => state.framerate as number),
  );
  const playerDuration = usePlayerStore(useShallow((state) => state.player.duration));
  const frameCount = Math.floor(framerate * (playerDuration / 1000));

  const timedFrames: { stamp: number; key: string }[] = useMemo(
    () =>
      Array.from({ length: frameCount + 1 }, (_v, i) => ({
        stamp: i / frameCount,
        key: `tick-frame-${i.toString()}`,
      })),
    [frameCount],
  );

  const transformSpring = useTrackTransformSpring(ignoreZoom, false);

  transformSpring.on("change", (t) => {
    tickRef.current?.setAttribute("transform", t);
  });

  // Calculate the distance between consecutive ticks in pixels
  const tickDistance = useMemo(() => {
    if (frameCount === 0) return 0;
    const range = xScale.range();
    return (range[1] - range[0]) / frameCount;
  }, [xScale, frameCount]);

  // Calculate opacity for minor ticks - fade between 4-6 pixels
  const minorTickOpacity = useMemo(() => {
    if (tickDistance <= 4) return 0;
    if (tickDistance >= 6) return 1;
    // Linear interpolation between 4-6 pixels
    return (tickDistance - 4) / (6 - 4);
  }, [tickDistance]);

  return (
    <motion.g
      ref={tickRef}
      transform={transformSpring.get()}
      // mask="url(#boundsMask)"
    >
      {timedFrames.map((tick, idx) => {
        const isMajor = idx % framerate === 0;
        const x = xScale(tick.stamp * playerDuration);

        // Skip rendering minor ticks if they're completely invisible
        if (!isMajor && minorTickOpacity === 0) {
          return null;
        }

        return (
          <motion.line
            key={tick.key}
            x1={x}
            x2={x}
            y1={0}
            y2={tickHeight}
            strokeWidth={isMajor ? majorTickSpring : minorTickSpring}
            opacity={isMajor ? 1 : minorTickOpacity}
            className={clsx(
              "transition-[stroke,opacity] duration-75 ease-in-out pointer-events-none",
              "stroke-neutral-300 dark:stroke-neutral-700",
              "group-aria-expanded:stroke-neutral-400 group-hover:stroke-neutral-400",
              "group-aria-expanded:dark:stroke-neutral-600 group-hover:dark:stroke-neutral-600",
            )}
          />
        );
      })}
    </motion.g>
  );
}

export const TrackBackground = memo(InnerTrackBackground);
