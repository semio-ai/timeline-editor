import { type ReactNode, useMemo } from "react";
import { ParentSize } from "@visx/responsive";
import { scaleLinear } from "@visx/scale";
import { animated } from "@react-spring/web";
import { useShallow } from "zustand/react/shallow";
import useMeasure from "react-use-measure";
import { clsx } from "clsx";
import type { AnimationData } from "./store-types";
import { type ScaleLinear } from "./scale-linear";
import { useAnimationStore } from "./hooks/use-animation-store";
import { TrackBoundsContext } from "./hooks/use-track-bounds";
import { TIMELINE_PADDING } from "./constants";
import { useStaticZoomedSpring } from "./hooks/use-static-zoomed-spring";
import PlayheadCart from "./playhead-cart";

function InnerRuler({
  width,
  side,
}: {
  width: number;
  side: "top" | "bottom";
}) {
  const framerate = useAnimationStore(
    useShallow((state: AnimationData) => state.framerate as number),
  );
  const duration = useAnimationStore(
    useShallow(
      (state: AnimationData) =>
        state.animations[state.activeAnimation]?.duration ?? 5000,
    ),
  );

  const xScale = useMemo(
    () =>
      scaleLinear({
        domain: [0, 1],
        range: [TIMELINE_PADDING, width - TIMELINE_PADDING],
        // clamp: true,
      }),
    [width],
  );

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
    <TrackBoundsContext.Provider
      value={{
        bounds: activeRegionBounds,
        scale: xScale,
        frameCount,
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
          <g
            x={side === "top" ? 0 : 4}
            // className={clsx("relative", side === "top" ? "top-0" : "top-[4px]")}
          >
            <rect
              ref={activeRegionRef}
              x={xScale(0)}
              width={Math.max(0, width - TIMELINE_PADDING * 2)}
              className="h-[24px]"
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
          <PlayheadCart side={side} ignoreZoom={side === "bottom"} />
        </svg>
      </div>
    </TrackBoundsContext.Provider>
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
  const major = idx % framerate === 0;

  return (
    <animated.g style={{ translateX: zoomedCompletion.to((s) => xScale(s)) }}>
      <animated.rect
        y={getY(side, major)}
        x={-0.5}
        width={1}
        height={major ? 12 : 6}
        className={clsx(
          "transition-[fill,transform] duration-75 ease-in-out",
          "fill-transparent",
          major
            ? "group-hover:fill-black group-hover:dark:fill-white"
            : "group-hover:fill-black/50 dark:group-hover:fill-white/50 group-aria-expanded:fill-black/50 dark:group-aria-expanded:fill-white/50",
        )}
      />
      {major && (
        <animated.text
          style={{ fontSize: 8, translateX: "-50%" }}
          y={side === "top" ? 9 : 24}
          className={clsx(
            "font-mono font-light",
            "group-hover:fill-black/50 dark:group-hover:fill-white/50 group-aria-expanded:fill-black/50 dark:group-aria-expanded:fill-white/50",
          )}
        >
          {idx}f
        </animated.text>
      )}
    </animated.g>
  );
}

function getY(side: "top" | "bottom", major: boolean) {
  if (side === "bottom") {
    return 4;
  } else if (major) {
    return 12;
  } else {
    return 18;
  }
}

export function Ruler({ side }: { side: "top" | "bottom" }): ReactNode {
  return (
    <div className="cursor-pointer items-center w-full">
      <ParentSize debounceTime={10}>
        {({ width }) => <InnerRuler width={width} side={side} />}
      </ParentSize>
    </div>
  );
}
