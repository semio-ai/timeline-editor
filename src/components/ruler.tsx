import { useMemo, useRef, memo } from "react";
import { scaleLinear } from "@visx/scale";
import { Text } from "@visx/text";
import { motion, MotionValue, useTransform } from "motion/react";
import { stampToVisualTime } from "@semio/ui";
import { shallow } from "zustand/shallow";
import { useShallow } from "zustand/react/shallow";
import useMeasure from "react-use-measure";
import { clsx } from "clsx";
import { usePlayerStore } from "@semio/utils";
import { TrackRender } from "../types";
import type { AnimationData } from "../store-types";
import { type ScaleLinear } from "../scale-linear";
import {
  useAnimationStore,
  TrackContext,
  useAltKeyPressed,
  usePlayerSubscription,
  useTrackTransformSpring,
  useScaleInverseSpring,
  useTrackContext,
} from "../hooks";
import { TIMELINE_PADDING } from "../constants";
import { PlayheadCart, HoverMarker, BoundCart, GestureDetector } from "./track-internals";

function InnerRuler({
  height = 32,
  side,
  animationId,
}: {
  height?: number;
  side: "top" | "bottom";
  animationId: string;
}) {
  const [svgRef, svgBounds] = useMeasure();
  const duration = usePlayerStore(useShallow((state) => state.player.duration));
  const framerate = useAnimationStore(
    useShallow((state: AnimationData) => state.framerate as number),
  );

  const zoomScale = useRef<ScaleLinear>(scaleLinear({ domain: [0, 1], range: [0, 1] }));

  usePlayerSubscription(
    (state) => state.player.viewport,
    (viewport) => {
      zoomScale.current.domain(side === "top" ? viewport : [0, 1]);
    },
    shallow,
  );

  const xScale = useMemo(
    () =>
      scaleLinear({
        domain: [0, duration],
        range: [TIMELINE_PADDING, svgBounds.width - TIMELINE_PADDING],
      }),
    [svgBounds.width, duration],
  );

  const yScale = useMemo(() => scaleLinear({ domain: [0, 1], range: [0, height] }), [height]);

  const frameCount = Math.floor(framerate * (duration / 1000));
  const [activeRegionRef, activeRegionBounds] = useMeasure();

  return (
    <TrackContext.Provider
      value={{
        animationId,
        instanceSettings: {
          active: true,
          offset: 0,
          timescale: 1,
        },
        animationDuration: duration,
        trackIds: [],
        bounds: activeRegionBounds,
        xScale,
        yScale,
        zoomScale,
        frameCount,
        color: "#737373",
        trackRender: TrackRender.Key,
        trackType: "multiple",
      }}
    >
      <svg ref={svgRef} height={height} className={clsx("touch-none w-full")}>
        {/* Gesture Detector */}
        <GestureDetector ignoreZoom={side === "bottom"} />
        <rect
          ref={activeRegionRef}
          x={TIMELINE_PADDING}
          height={svgBounds.height}
          width={Math.max(0, svgBounds.width - TIMELINE_PADDING * 2)}
          className="pointer-events-none fill-transparent"
        />
        <TickRegion ignoreZoom={side === "bottom"} side={side} />
        <HoverMarker ignoreZoom={side === "bottom"} height={height} />
        <BoundCart side={side} end="left" ignoreZoom={side === "bottom"} />
        <BoundCart side={side} end="right" ignoreZoom={side === "bottom"} />
        <PlayheadCart side={side} ignoreZoom={side === "bottom"} duration={duration} />
      </svg>
    </TrackContext.Provider>
  );
}

function TickRegion({ ignoreZoom, side }: { ignoreZoom: boolean; side: "top" | "bottom" }) {
  const {
    xScale,
    bounds: { height },
  } = useTrackContext();
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
        key: `${side}-frame-${i.toString()}`,
      })),
    [frameCount, side],
  );

  const transformSpring = useTrackTransformSpring(ignoreZoom, false);

  transformSpring.on("change", (t) => {
    tickRef.current?.setAttribute("transform", t);
  });

  const inverseScaleSpring = useScaleInverseSpring(ignoreZoom);

  const strokeWidthSpring = useTransform(inverseScaleSpring, (scale) => scale * 2);

  return (
    <motion.g ref={tickRef} transform={transformSpring.get()}>
      {timedFrames.map((tick, idx) => (
        <Tick
          key={tick.key}
          widthSpring={strokeWidthSpring}
          completion={tick.stamp}
          xScale={xScale}
          playerDuration={playerDuration}
          framerate={framerate}
          ignoreZoom={ignoreZoom}
          side={side}
          idx={idx}
          height={height}
        />
      ))}
    </motion.g>
  );
}

function Tick({
  ignoreZoom = false,
  completion,
  xScale,
  side,
  playerDuration,
  widthSpring,
  idx,
  framerate,
  height,
}: {
  completion: number;
  ignoreZoom?: boolean;
  xScale: ScaleLinear;
  side: "top" | "bottom";
  framerate: number;
  playerDuration: number;
  widthSpring: MotionValue<number>;
  height: number;
  idx: number;
}) {
  const [timeDisplay] = useAnimationStore(
    useShallow((state: AnimationData) => [state.timeDisplay]),
  );
  const altPressed = useAltKeyPressed();
  const visualTime = stampToVisualTime(
    completion,
    playerDuration,
    framerate,
    timeDisplay,
    altPressed,
  );
  const major = idx % framerate === 0;

  const transform = `translate(${xScale(completion * playerDuration).toString()} 0)`;
  const y1 = side === "bottom" ? 1 : height - 1;
  const y2 = getY2(side, major, height);

  return (
    <g transform={transform}>
      <motion.line
        x1={0}
        x2={0}
        y1={y1}
        y2={y2}
        strokeWidth={widthSpring}
        className={clsx(
          "transition-[stroke,transform] duration-75 ease-in-out pointer-events-none",
          major
            ? "group-hover:stroke-black dark:group-hover:stroke-white group-aria-expanded:stroke-black group-aria-expanded:dark:stroke-white"
            : "group-hover:stroke-neutral-300 dark:group-hover:stroke-neutral-700 group-aria-expanded:stroke-neutral-300 dark:group-aria-expanded:stroke-neutral-700",
        )}
      />
      {major && (
        <ScaledText ignoreZoom={ignoreZoom} x={0} y={side === "top" ? 8 : 16}>
          {visualTime}
        </ScaledText>
      )}
    </g>
  );
}

function ScaledText({
  children,
  ignoreZoom,
  x,
  y,
}: {
  children: string;
  ignoreZoom: boolean;
  x: number;
  y: number;
}) {
  const textRef = useRef<SVGTextElement>(null);

  const scaleSpring = useScaleInverseSpring(ignoreZoom);

  const transform = useTransform(scaleSpring, (scale) => `scale(${scale.toString()} 1)`);

  transform.on("change", (t) => textRef.current?.setAttribute("transform", t));

  return (
    <Text
      innerTextRef={textRef}
      textAnchor="middle"
      verticalAnchor="start"
      transform={transform.get()}
      x={x}
      y={y}
      fontSize={10}
      className={clsx(
        "font-mono font-light pointer-events-none fill-transparent transition-colors",
        "group-hover:fill-black/50 dark:group-hover:fill-white/50 group-aria-expanded:fill-black/50 dark:group-aria-expanded:fill-white/50",
      )}
    >
      {children}
    </Text>
  );
}

function getY2(side: "top" | "bottom", major: boolean, height = 30) {
  if (side === "bottom") {
    return 1 + (major ? MAJOR_TICK_HEIGHT : MINOR_TICK_HEIGHT);
  } else if (major) {
    return height - (1 + MAJOR_TICK_HEIGHT);
  } else {
    return height - (1 + MINOR_TICK_HEIGHT);
  }
}

export const Ruler = memo(InnerRuler);

const MINOR_TICK_HEIGHT = 4;
const MAJOR_TICK_HEIGHT = 8;
