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
  width = 2 * TIMELINE_PADDING,
  side,
  animationId,
}: {
  height?: number;
  width?: number;
  side: "top" | "bottom";
  animationId: string;
}) {
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
        range: [TIMELINE_PADDING, width - TIMELINE_PADDING],
      }),
    [width, duration],
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
      <svg height={height} className={clsx("touch-none w-full focus:outline-none")}>
        {/* Gesture Detector */}
        <GestureDetector ignoreZoom={side === "bottom"} />
        <rect
          ref={activeRegionRef}
          x={TIMELINE_PADDING}
          height={height}
          width={Math.max(0, width - TIMELINE_PADDING * 2)}
          className="pointer-events-none fill-transparent"
        />
        <TickRegion ignoreZoom={side === "bottom"} side={side} />
        <HoverMarker ignoreZoom={side === "bottom"} />
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

  if (!major) {
    return null;
  }

  const transform = `translate(${xScale(completion * playerDuration).toString()} 0)`;
  const y1 = side === "bottom" ? 1 : height - 1;
  const y2 = getY2(side, major, height);

  return (
    <g transform={transform}>
      <motion.line
        x1={0}
        x2={0}
        y1={y1 ?? 0}
        y2={y2 ?? 0}
        strokeWidth={widthSpring}
        className={clsx(
          "transition-[stroke,transform] duration-75 ease-in-out pointer-events-none",
          "stroke-neutral-500",
          "group-hover/sheet:stroke-black dark:group-hover/sheet:stroke-white",
          "group-aria-expanded/sheet:stroke-black group-aria-expanded/sheet:dark:stroke-white",
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
        "font-mono font-light pointer-events-none transition-colors",
        "fill-neutral-500",
        "group-hover/sheet:fill-black dark:group-hover/sheet:fill-white",
        "group-aria-expanded/sheet:fill-black group-aria-expanded/sheet:dark:fill-white",
      )}
    >
      {children}
    </Text>
  );
}

// Gets the y2 value for the tick line based on the side and whether it's a major or minor tick
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
