import { memo, useMemo, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import { motion, MotionValue, useTransform } from "motion/react";
import { usePlayerStore } from "@semio/utils";
import { clsx } from "clsx";
import {
  useAnimationStore,
  useTrackContext,
  useBoundSprings,
  useTrackTransformSpring,
  useScaleInverseSpring,
} from "../../hooks";
import { AnimationData } from "../../store-types";
import { TIMELINE_PADDING } from "../../constants";
import type { ScaleLinear } from "../../scale-linear";

export interface TrackBackgroundProps {
  showTicks?: boolean;
  ignoreZoom?: boolean;
  tickHeight?: number;
}

function InnerTrackBackground({
  showTicks = true,
  ignoreZoom = false,
  tickHeight = 210,
}: TrackBackgroundProps) {
  const {
    trackIds,
    xScale,
    attribute,
    bounds: { width },
  } = useTrackContext();

  const playerDuration = usePlayerStore(useShallow((state) => state.player.duration));

  const identifier: string =
    trackIds?.join("-") ?? `default-${tickHeight.toString()}${attribute ? `-${attribute}` : ""}`;

  const bounds = usePlayerStore(useShallow((state) => state.player.bounds));

  const framerate = useAnimationStore(
    useShallow((state: AnimationData) => state.framerate as number),
  );

  const { leftSpring, widthSpring } = useBoundSprings(ignoreZoom);

  const frameCount = Math.floor(framerate * (playerDuration / 1000));

  const timedFrames: { stamp: number; key: string }[] = useMemo(
    () =>
      showTicks
        ? Array.from({ length: frameCount + 1 }, (_v, i) => ({
            stamp: i / frameCount,
            key: `${identifier}-frame-${i.toString()}`,
          }))
        : [],
    [frameCount, identifier, showTicks],
  );

  const tickRef = useRef<SVGGElement>(null);

  const transformSpring = useTrackTransformSpring(ignoreZoom, true);

  transformSpring.on("change", (t) => {
    tickRef.current?.setAttribute("transform", t);
  });

  const inverseScaleSpring = useScaleInverseSpring(ignoreZoom);

  const strokeWidthSpring = useTransform(inverseScaleSpring, (scale) => scale * 2);

  return (
    <>
      <defs>
        {/* Create a bounds mask that can be used elsewhere */}
        <mask id="boundsMask" className="h-full" width={width + TIMELINE_PADDING * 2}>
          <rect
            key={`${identifier}-linebg`}
            x={0}
            width={width + TIMELINE_PADDING * 2}
            y={0}
            className="fill-white/50 pointer-events-none h-full"
          />
          <motion.rect
            x={leftSpring}
            y={0}
            width={widthSpring}
            className="fill-white pointer-events-none h-full"
          />
        </mask>
        {/* Create a mask for the timeline */}
        <mask
          id={`mask-${identifier}`}
          className="h-full"
          x={-10}
          width={width + TIMELINE_PADDING * 2}
        >
          <motion.g ref={tickRef} transform={transformSpring.get()}>
            {timedFrames.map((tick) => (
              <Tick
                key={tick.key}
                widthSpring={strokeWidthSpring}
                completion={tick.stamp}
                xScale={xScale}
                outsideBounds={tick.stamp < bounds[0] || tick.stamp > bounds[1]}
                tickHeight={tickHeight}
                playerDuration={playerDuration}
              />
            ))}
          </motion.g>
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

      {trackIds?.length === 1 && (
        <rect
          x={0}
          width={width + TIMELINE_PADDING * 2}
          mask="url(#boundsMask)"
          className={clsx(
            "h-[calc(100%-0.5px)]",
            "transition-[fill,opacity] duration-75 fill-[--track-color] pointer-events-none",
            "translate-y-[0.5px] opacity-20 group-[.has-emphasis]/track:opacity-30",
          )}
        />
      )}

      <rect
        name="box1"
        width={width + TIMELINE_PADDING * 2}
        mask={`url(#mask-${identifier})`}
        className={clsx(
          "transition-[fill] duration-75",
          "translate-y-[0.5px]",
          "h-[calc(100%-0.5px)]",
          "group-aria-expanded:opacity-100 group-hover:opacity-100 opacity-0",
          "pointer-events-none fill-black/10 dark:fill-white/10",
        )}
      />

      <rect
        name="box2"
        x={0}
        width={width + TIMELINE_PADDING * 2}
        mask={`url(#mask-${identifier})`}
        className={clsx(
          "transition-[fill] duration-75 fill-neutral-500",
          "h-[calc(100%-0.5px)]",
          "translate-y-[0.5px] pointer-events-none",
          "group-aria-expanded:opacity-0 group-hover:opacity-0 opacity-100",
        )}
      />
    </>
  );
}

function Tick({
  completion,
  xScale,
  outsideBounds,
  widthSpring,
  tickHeight,
  playerDuration,
}: {
  completion: number;
  xScale: ScaleLinear;
  outsideBounds: boolean;
  widthSpring: MotionValue<number>;
  tickHeight: number;
  playerDuration: number;
}) {
  const x = xScale(completion * playerDuration);
  return (
    <motion.line
      x1={x}
      x2={x}
      y1={0}
      y2={tickHeight}
      strokeWidth={widthSpring}
      className={clsx(
        "h-full",
        "transition-[stroke,transform] duration-75 ease-in-out stroke-transparent pointer-events-none",
        !outsideBounds && "group-aria-expanded:stroke-neutral-300 group-hover:stroke-neutral-300",
        outsideBounds && "group-aria-expanded:stroke-neutral-700 group-hover:stroke-neutral-700",
      )}
    />
  );
}

export const TrackBackground = memo(InnerTrackBackground);
