import { memo, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import { motion } from "motion/react";
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
    xScale,
    attribute,
    bounds: { width, height },
  } = useTrackContext();

  const color = useColors(trackIds);

  const playerDuration = usePlayerStore(useShallow((state) => state.player.duration));

  const trackSet = trackIds === undefined || trackIds.length === 0 ? ["empty"] : trackIds;

  const identifier = `${trackSet.join("-")}${attribute ? `-${attribute}` : "-all"}`;

  const framerate = useAnimationStore(
    useShallow((state: AnimationData) => state.framerate as number),
  );

  const { leftSpring, widthSpring } = useBoundSprings(ignoreZoom);

  const ticksRef = useRef<SVGRectElement>(null);

  const transformSpring = useTrackTransformSpring(ignoreZoom, true);

  transformSpring.on("change", (t) => {
    ticksRef.current?.setAttribute("transform", t);
  });

  const inverseScaleSpring = useScaleInverseSpring(ignoreZoom);

  return (
    <>
      <defs>
        {/* Create a bounds mask that can be used elsewhere */}
        <mask id="boundsMask" height={height} width={width + TIMELINE_PADDING * 2}>
          {/* A full-width spanning element at a 50% color */}
          <rect
            key={`${identifier}-linebg`}
            x={0}
            height={height}
            width={width + TIMELINE_PADDING * 2}
            y={0}
            className="fill-neutral-500 pointer-events-none"
          />
          {/* A full-opacity (white) region of the mask for the active region */}
          <motion.rect
            x={leftSpring}
            y={0}
            height={height}
            width={widthSpring}
            className="fill-white pointer-events-none"
          />
        </mask>

        <pattern
          id="tickPattern"
          patternUnits="userSpaceOnUse"
          height={height <= 0 ? 1 : height}
          width={(width * 1000) / (framerate * playerDuration)}
        >
          {showTicks && (
            <motion.line
              x1={xScale(1 / framerate)}
              x2={xScale(1 / framerate)}
              y1={0}
              y2={tickHeight ?? 0}
              strokeWidth={inverseScaleSpring}
              className={clsx(
                "h-full",
                "transition-[stroke] duration-75 ease-in-out pointer-events-none",
                "stroke-neutral-300 dark:stroke-neutral-700",
                "group-aria-expanded:stroke-neutral-400 group-hover:stroke-neutral-400",
                "group-aria-expanded:dark:stroke-neutral-600 group-hover:dark:stroke-neutral-600",
              )}
            />
          )}
        </pattern>

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
      <rect
        name="ticks-display"
        ref={ticksRef}
        transform={transformSpring.get()}
        width="100%"
        height="100%"
        // fill="red"
        fill="url(#tickPattern)"
        mask="url(#boundsMask)"
      />

      {/* Show the colored background (if necessary) */}
      {showBackground && (
        <rect
          name="track-colored-background"
          width={width + TIMELINE_PADDING * 2}
          fill={color}
          mask="url(#boundsMask)"
          className={clsx(
            "transition-[fill] duration-75",
            "translate-y-[0.5px]",
            "h-[calc(100%-0.5px)]",
            "group-hover/track:opacity-35 group-data-[highlighted]:opacity-35 opacity-20",
            "pointer-events-none",
          )}
        />
      )}
    </>
  );
}

export const TrackBackground = memo(InnerTrackBackground);
