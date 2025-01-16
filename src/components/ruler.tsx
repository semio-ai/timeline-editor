import { type ReactNode, useMemo, useRef } from "react";
import { ParentSize } from "@visx/responsive";
import { scaleLinear } from "@visx/scale";
import { animated } from "@react-spring/web";
import { stampToVisualTime } from "@semio/ui";
import { shallow } from "zustand/shallow";
import { useShallow } from "zustand/react/shallow";
import useMeasure from "react-use-measure";
import { clsx } from "clsx";
import { TrackRender } from "../types";
import type { AnimationData } from "../store-types";
import { type ScaleLinear } from "../scale-linear";
import {
  useAnimationStore,
  TrackContext,
  useStaticZoomedSpring,
  useAltKeyPressed,
  usePlayerSubscription,
} from "../hooks";
import { TIMELINE_PADDING } from "../constants";
import {
  PlayheadCart,
  HoverMarker,
  BoundCart,
  AnimatedText,
  GestureDetector,
} from "./track-internals";

function InnerRuler({
  width,
  side,
  animationId,
}: {
  width: number;
  side: "top" | "bottom";
  animationId: string;
}) {
  const framerate = useAnimationStore(
    useShallow((state: AnimationData) => state.framerate as number),
  );
  const duration = useAnimationStore(
    useShallow((state: AnimationData) => state.animations[animationId]?.duration ?? 5000),
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
        domain: [0, 1],
        range: [TIMELINE_PADDING, width - TIMELINE_PADDING],
      }),
    [width],
  );

  const yScale = useMemo(() => scaleLinear({ domain: [0, 1], range: [0, 6] }), []);

  const frameCount = Math.floor(framerate * (duration / 1000));
  const [activeRegionRef, activeRegionBounds] = useMeasure();

  const timedFrames: { stamp: number; key: string }[] = useMemo(
    () =>
      Array.from({ length: frameCount + 1 }, (_v, i) => ({
        stamp: i / frameCount,
        key: `${side}-frame-${i.toString()}`,
      })),
    [frameCount, side],
  );

  return (
    <TrackContext.Provider
      value={{
        animationId,
        instanceSettings: {
          active: true,
          offset: 0,
          timescale: 1,
        },
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
            {timedFrames.map((tick, i) => (
              <Tick
                key={tick.key}
                completion={tick.stamp}
                xScale={xScale}
                side={side}
                framerate={framerate}
                idx={i}
                ignoreZoom={side === "bottom"}
              />
            ))}
          </g>

          <HoverMarker
            ignoreZoom={side === "bottom"}
            height={24}
            offset={side === "bottom" ? 4 : 0}
          />
          <BoundCart side={side} end="left" ignoreZoom={side === "bottom"} />
          <BoundCart side={side} end="right" ignoreZoom={side === "bottom"} />
          <PlayheadCart side={side} ignoreZoom={side === "bottom"} />
        </svg>
      </div>
    </TrackContext.Provider>
  );
}

function Tick({
  ignoreZoom = false,
  completion,
  xScale,
  side,
  framerate,
  idx,
}: {
  completion: number;
  ignoreZoom?: boolean;
  xScale: ScaleLinear;
  side: "top" | "bottom";
  framerate: number;
  idx: number;
}) {
  const zoomedCompletion = useStaticZoomedSpring(completion, ignoreZoom);
  const [duration, timeDisplay] = useAnimationStore(
    useShallow((state: AnimationData) => [
      state.animations[state.activeAnimation]?.duration ?? 5000,
      state.timeDisplay,
    ]),
  );
  const altPressed = useAltKeyPressed();
  const visualTime = stampToVisualTime(completion, duration, framerate, timeDisplay, altPressed);
  const major = idx % framerate === 0;

  return (
    <animated.g style={{ translateX: zoomedCompletion.to((s) => xScale(s)) }}>
      <animated.rect
        y={getY(side, major)}
        x={major ? -1 : -0.5}
        width={major ? 2 : 1}
        height={major ? 6 : 4}
        className={clsx(
          "transition-[fill,transform] duration-75 ease-in-out",
          "fill-transparent pointer-events-none",
          major
            ? "group-hover:fill-black group-hover:dark:fill-white group-aria-expanded:fill-black group-aria-expanded:dark:fill-white"
            : "group-hover:fill-black/50 dark:group-hover:fill-white/50 group-aria-expanded:fill-black/50 dark:group-aria-expanded:fill-white/50",
        )}
      />
      {major && (
        <AnimatedText
          textAnchor="middle"
          verticalAnchor="start"
          x={0}
          y={side === "top" ? 5 : 15.5}
          fontSize={10}
          className={clsx(
            "font-mono font-light pointer-events-none",
            "group-hover:fill-black/50 dark:group-hover:fill-white/50 group-aria-expanded:fill-black/50 dark:group-aria-expanded:fill-white/50",
          )}
        >
          {visualTime}
        </AnimatedText>
      )}
    </animated.g>
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
