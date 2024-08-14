import { memo, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { animated } from "@react-spring/web";
import { clsx } from "clsx";
// import { useDeep } from "@semio/utils";
import { useAnimationStore } from "./hooks/use-animation-store";
// import { FrameMarker } from "./frame-marker";
import { AnimationData } from "./store-types";
// import { computeFrames } from "./actions/compute-frames";
import { useHoverSpring } from "./hooks/use-hover-spring";
import { useTrackBounds } from "./hooks/use-track-bounds";

export interface TrackBackgroundProps {
  trackIds?: string[];
  showLine?: boolean;
}

function InnerTrackBackground({
  trackIds,
  showLine = true,
}: TrackBackgroundProps) {
  const identifier: string = trackIds?.join("-") ?? "default";
  const { scale: xScale, zoom: zoomScale } = useTrackBounds();
  const { hoverpoint } = useHoverSpring();
  const bounds = useAnimationStore(useShallow((state) => state.player.bounds));
  const framerate = useAnimationStore(
    useShallow((state: AnimationData) => state.framerate as number),
  );
  const duration = useAnimationStore(
    useShallow(
      (state: AnimationData) =>
        state.animations[state.activeAnimation]?.duration ?? 5000,
    ),
  );

  const frameCount = Math.floor(framerate * (duration / 1000));

  const timedFrames: { stamp: number; key: string }[] = useMemo(
    () =>
      Array.from({ length: frameCount + 1 }, (_v, i) => ({
        stamp: i / frameCount,
        key: `${identifier}-frame-${i.toString()}`,
      })),
    [frameCount, identifier],
  );

  return (
    <>
      <defs>
        {/* Create a gradient for the background of the timeline */}
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="0%">
          <animated.stop offset="0%" stopColor="transparent" />
          <animated.stop
            offset={hoverpoint.to(
              (hp) =>
                `${Math.max(0, zoomScale(hp ?? -Infinity) * 100 - 30).toString()}%`,
            )}
            stopColor="transparent"
          />
          <animated.stop
            offset={hoverpoint.to(
              (hp) => `${(zoomScale(hp ?? -Infinity) * 100).toString()}%`,
            )}
            stopColor="#737373"
          />
          <animated.stop
            offset={hoverpoint.to(
              (hp) =>
                `${Math.min(100, zoomScale(hp ?? -Infinity) * 100 + 30).toString()}%`,
            )}
            stopColor="transparent"
          />
          <animated.stop offset="100%" stopColor="transparent" />
        </linearGradient>
        <mask id="mask">
          {showLine && (
            <rect
              key={`${identifier}-mask`}
              x={xScale(bounds[0])}
              width={Math.max(0, xScale(bounds[1] - bounds[0]))}
              y={10.75}
              height={7.5}
              className="group-hover:fill-transparent group-aria-expanded:fill-transparent fill-white transition-[fill] duration-75 ease-in-out"
            />
          )}
          {showLine && (
            <rect
              key={`${identifier}-leftmask`}
              x={xScale(0)}
              width={Math.max(0, xScale(bounds[0]))}
              y={10.75}
              height={7.5}
              className="group-hover:fill-transparent group-aria-expanded:fill-transparent fill-white/50 transition-[fill] duration-75 ease-in-out"
            />
          )}
          {showLine && (
            <rect
              key={`${identifier}-rightmask`}
              x={xScale(bounds[1])}
              width={Math.max(0, xScale(1 - bounds[1]))}
              y={10.75}
              height={7.5}
              className="group-hover:fill-transparent group-aria-expanded:fill-transparent fill-white/50 transition-[fill] duration-75 ease-in-out"
            />
          )}
          {timedFrames.map((tick) => (
            <rect
              key={tick.key}
              x={xScale(zoomScale(tick.stamp)) - 1}
              y={0}
              width={2}
              height={30}
              className={clsx(
                "transition-[fill,transform] duration-75 ease-in-out group-aria-expanded:fill-white group-hover:fill-neutral-300 fill-transparent",
                tick.stamp < bounds[0] || tick.stamp > bounds[1]
                  ? "scale-y-[33%] translate-y-[10px] group-aria-expanded:fill-neutral-700 group-hover:fill-neutral-700"
                  : "group-aria-expanded:fill-white group-hover:fill-white",
              )}
            />
          ))}
        </mask>
      </defs>
      <rect
        x={xScale(0)}
        width={xScale(1)}
        mask="url(#mask)"
        fill="url(#bg)"
        className={clsx(
          "transition-[fill] duration-75",
          "h-[29px] translate-y-[0.5px]",
          "group-aria-expanded:opacity-100 group-hover:opacity-100 opacity-0",
          "",
          // "fill-neutral-500 h-[29px] translate-y-[0.5px]",
          // "fill-neutral-400 dark:fill-neutral-600 h-[7.5px] translate-y-[10.75px]",
          // "group-aria-expanded:fill-[url(#bg)] group-hover:fill-[url(#bg)]",
          // "group-aria-expanded:h-[29px] group-hover:h-[29px] group-aria-expanded:translate-y-[0.5px] group-hover:translate-y-[0.5px]",
        )}
      />

      <rect
        x={xScale(0)}
        width={xScale(1)}
        mask="url(#mask)"
        className={clsx(
          "transition-[fill] duration-75 fill-neutral-500",
          "h-[29px] translate-y-[0.5px]",
          "group-aria-expanded:opacity-0 group-hover:opacity-0 opacity-100",
        )}
      />
    </>
  );
}

export const TrackBackground = memo(InnerTrackBackground);
