import { type ReactNode, useMemo, useRef } from "react";
import { ParentSize } from "@visx/responsive";
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
  width,
  side,
  animationId,
}: {
  width: number;
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

  const yScale = useMemo(() => scaleLinear({ domain: [0, 1], range: [0, 6] }), []);

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
      <div className={clsx("h-6 relative")}>
        <svg
          height={28}
          className={clsx(
            "absolute left-0 right-0 h-7",
            "touch-none fill-transparent",
            side === "top" ? "bottom-[-4px]" : "top-[-4px]",
          )}
          width={width < 0 ? 0 : width}
        >
          {/* Gesture Detector */}
          <GestureDetector ignoreZoom={side === "bottom"} height={28} />
          <g x={side === "top" ? 0 : 4}>
            <rect
              ref={activeRegionRef}
              x={xScale(0)}
              width={Math.max(0, width - TIMELINE_PADDING * 2)}
              className="h-[24px] pointer-events-none"
            />
            <TickRegion ignoreZoom={side === "bottom"} side={side} />
          </g>

          <HoverMarker
            ignoreZoom={side === "bottom"}
            height={24}
            offset={side === "bottom" ? 4 : 0}
          />
          <BoundCart side={side} end="left" ignoreZoom={side === "bottom"} />
          <BoundCart side={side} end="right" ignoreZoom={side === "bottom"} />
          <PlayheadCart side={side} ignoreZoom={side === "bottom"} duration={duration} />
        </svg>
      </div>
    </TrackContext.Provider>
  );
}

function TickRegion({ ignoreZoom, side }: { ignoreZoom: boolean; side: "top" | "bottom" }) {
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
}: {
  completion: number;
  ignoreZoom?: boolean;
  xScale: ScaleLinear;
  side: "top" | "bottom";
  framerate: number;
  playerDuration: number;
  widthSpring: MotionValue<number>;
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
  const y1 = getY(side, major);
  const y2 = y1 + (major ? 6 : 4);

  const width = useTransform(widthSpring, (w) => w * (major ? 1 : 0.5));

  return (
    <g transform={transform}>
      <motion.line
        x1={0}
        x2={0}
        y1={y1}
        y2={y2}
        strokeWidth={width}
        className={clsx(
          "transition-[stroke,transform] duration-75 ease-in-out pointer-events-none",
          major
            ? "group-hover:stroke-black group-hover:dark:stroke-white group-aria-expanded:stroke-black group-aria-expanded:dark:stroke-white"
            : "group-hover:stroke-black/50 dark:group-hover:stroke-white/50 group-aria-expanded:stroke-black/50 dark:group-aria-expanded:stroke-white/50",
        )}
      />
      {major && (
        <ScaledText ignoreZoom={ignoreZoom} x={0} y={side === "top" ? 5 : 15.5}>
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
        "font-mono font-light pointer-events-none",
        "group-hover:fill-black/50 dark:group-hover:fill-white/50 group-aria-expanded:fill-black/50 dark:group-aria-expanded:fill-white/50",
      )}
    >
      {children}
    </Text>
  );
}

function getY(side: "top" | "bottom", major: boolean) {
  if (side === "bottom") {
    return 4;
  } else if (major) {
    return 18;
  } else {
    return 20;
  }
}

export function Ruler({
  side,
  animationId,
}: {
  side: "top" | "bottom";
  animationId: string;
}): ReactNode {
  return (
    <div className="cursor-pointer items-center w-full">
      <ParentSize debounceTime={10}>
        {({ width }) => <InnerRuler width={width} side={side} animationId={animationId} />}
      </ParentSize>
    </div>
  );
}
