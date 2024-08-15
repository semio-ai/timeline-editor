import { type ReactNode, useMemo } from "react";
import { ParentSize } from "@visx/responsive";
import { scaleLinear } from "@visx/scale";
import { useShallow } from "zustand/react/shallow";
import useMeasure from "react-use-measure";
import { clsx } from "clsx";
import type { AnimationData } from "./store-types";
import { useAnimationStore } from "./hooks/use-animation-store";
import { TrackBoundsContext } from "./hooks/use-track-bounds";
import { TIMELINE_PADDING } from "./constants";

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

  const viewport = useAnimationStore(
    useShallow((state: AnimationData) => state.player.viewport),
  );

  const zoomScale = useMemo(
    () =>
      scaleLinear({
        domain: side === "top" ? viewport : [0, 1],
        range: [0, 1],
      }),
    [side, viewport],
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
        zoom: zoomScale,
      }}
    >
      <svg
        height={16}
        className="touch-none fill-transparent w-full"
        width={width < 0 ? 0 : width}
      >
        <rect
          ref={activeRegionRef}
          x={xScale(0)}
          width={Math.max(0, width - TIMELINE_PADDING * 2)}
          className="h-[16px]"
        />
        {timedFrames.map((tick, i) => (
          <rect
            key={tick.key}
            x={xScale(zoomScale(tick.stamp)) - 0.5}
            y={getY(side, framerate, i)}
            width={1}
            height={i % framerate === 0 ? 8 : 4}
            className={clsx(
              "transition-[fill,transform] duration-75 ease-in-out",
              i % framerate === 0
                ? "fill-black dark:fill-white"
                : "fill-black/50 dark:fill-white/50",
            )}
          />
        ))}
      </svg>
    </TrackBoundsContext.Provider>
  );
}

function getY(side: "top" | "bottom", framerate: number, index: number) {
  if (side === "bottom") {
    return 0;
  } else if (index % framerate === 0) {
    return 8;
  } else {
    return 12;
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
