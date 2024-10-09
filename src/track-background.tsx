import { memo, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { animated } from "@react-spring/web";
import { clsx } from "clsx";
import { useAnimationStore } from "./hooks/use-animation-store";
import { AnimationData } from "./store-types";
import type { ScaleLinear } from "./scale-linear";
import { useTrackBounds } from "./hooks/use-track-bounds";
import { useStaticZoomedSpring } from "./hooks/use-static-zoomed-spring";
import { useBoundSprings } from "./hooks/use-bound-springs";
import { TIMELINE_PADDING } from "./constants";

export interface TrackBackgroundProps {
  trackIds?: string[];
  showLine?: boolean;
  ignoreZoom?: boolean;
  tickHeight?: number;
}

function InnerTrackBackground({
  trackIds,
  showLine = true,
  ignoreZoom = false,
  tickHeight = 30,
}: TrackBackgroundProps) {
  const identifier: string = trackIds?.join("-") ?? "default";
  const {
    scale: xScale,
    bounds: { width },
  } = useTrackBounds();

  const bounds = useAnimationStore(useShallow((state) => state.player.bounds));

  const framerate = useAnimationStore(
    useShallow((state: AnimationData) => state.framerate as number),
  );
  const duration = useAnimationStore(
    useShallow((state: AnimationData) => state.animations[state.activeAnimation]?.duration ?? 5000),
  );

  const { leftSpring, widthSpring } = useBoundSprings(ignoreZoom);

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
        {/* Create a bounds mask that can be used elsewhere */}
        <mask id="boundsMask">
          <animated.rect
            key={`${identifier}-linebg`}
            x={0}
            width={width}
            y={0}
            height={tickHeight}
            className="fill-white/50 pointer-events-none"
          />
          <animated.rect
            x={leftSpring.to((ls) => xScale(ls))}
            y={0}
            width={widthSpring.to((ws) => Math.max(0, xScale(ws) - TIMELINE_PADDING))}
            height={tickHeight}
            className="fill-white pointer-events-none"
          />
        </mask>
        {/* Create a mask for the timeline */}
        <mask id="mask">
          {showLine && (
            <>
              <animated.rect
                key={`${identifier}-linebg`}
                x={xScale(-10)}
                width={width}
                y={10.75}
                height={7.5}
                className="group-hover:fill-transparent group-aria-expanded:fill-transparent fill-white/25 transition-[fill] duration-75 ease-in-out pointer-events-none"
              />
              <animated.rect
                x={leftSpring.to((ls) => xScale(ls))}
                y={10.75}
                width={widthSpring.to((ws) => Math.max(0, xScale(ws) - TIMELINE_PADDING))}
                height={7.5}
                className="group-hover:fill-transparent group-aria-expanded:fill-transparent fill-white transition-[fill] duration-75 ease-in-out pointer-events-none"
              />
            </>
          )}

          {timedFrames.map((tick) => (
            <Tick
              key={tick.key}
              completion={tick.stamp}
              ignoreZoom={ignoreZoom}
              xScale={xScale}
              outsideBounds={tick.stamp < bounds[0] || tick.stamp > bounds[1]}
              tickHeight={tickHeight}
            />
          ))}
        </mask>
      </defs>

      <rect
        x={xScale(0)}
        width={Math.max(0, xScale(1))}
        mask="url(#boundsMask)"
        height={tickHeight - 1}
        className={clsx(
          "transition-[fill,opacity] duration-75 fill-[--track-color] pointer-events-none",
          "translate-y-[0.5px] opacity-20 group-[.has-emphasis]/track:opacity-30",
        )}
      />
      <rect
        x={xScale(0)}
        width={Math.max(0, xScale(1))}
        mask="url(#mask)"
        height={tickHeight - 1}
        className={clsx(
          "transition-[fill] duration-75",
          "translate-y-[0.5px]",
          "group-aria-expanded:opacity-100 group-hover:opacity-100 opacity-0",
          "pointer-events-none fill-black/10 dark:fill-white/10",
        )}
      />

      <rect
        x={xScale(0)}
        width={Math.max(0, xScale(1))}
        mask="url(#mask)"
        height={tickHeight - 1}
        className={clsx(
          "transition-[fill] duration-75 fill-neutral-500",
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
  ignoreZoom,
  tickHeight,
}: {
  completion: number;
  xScale: ScaleLinear;
  outsideBounds: boolean;
  ignoreZoom?: boolean;
  tickHeight: number;
}) {
  const zoomedCompletion = useStaticZoomedSpring(completion, ignoreZoom);
  return (
    <animated.rect
      x={zoomedCompletion.to((c) => xScale(c) - 1)}
      y={0}
      width={2}
      height={tickHeight}
      className={clsx(
        "transition-[fill,transform] duration-75 ease-in-out fill-transparent pointer-events-none",
        !outsideBounds && "group-aria-expanded:fill-neutral-300 group-hover:fill-neutral-300",
        outsideBounds && "group-aria-expanded:fill-neutral-700 group-hover:fill-neutral-700",
      )}
    />
  );
}

export const TrackBackground = memo(InnerTrackBackground);
