import { memo, useMemo, useRef } from "react";
import { scaleLinear } from "@visx/scale";
import useMeasure from "react-use-measure";
import { useShallow } from "zustand/react/shallow";
import { shallow } from "zustand/shallow";
import { TrackContext, useAnimationStore, usePlayerSubscription } from "../hooks";
import { ScaleLinear } from "../scale-linear";
import { TIMELINE_PADDING } from "../constants";
import { type AnimationData } from "../store-types";
import { TrackRender } from "../types";
import {
  TrackBackground,
  GestureDetector,
  BoundsDisplay,
  HoverMarker,
  Playhead,
} from "./track-internals";

export function InnerTrackGap({ animationId, height }: { height: number; animationId: string }) {
  const framerate = useAnimationStore(
    useShallow((state: AnimationData) => state.framerate as number),
  );
  const duration = useAnimationStore(
    useShallow((state: AnimationData) => state.animations[animationId]?.duration ?? 5000),
  );

  const frameCount = Math.floor(framerate * (duration / 1000));

  const [containerRef, containerBounds] = useMeasure();
  const [activeRegionRef, activeRegionBounds] = useMeasure();

  const xScale = useMemo(
    () =>
      scaleLinear({
        domain: [0, duration],
        range: [TIMELINE_PADDING, containerBounds.width - TIMELINE_PADDING],
      }),
    [containerBounds.width, duration],
  );

  const yScale = useMemo(() => scaleLinear({ domain: [0, 1], range: [0, height] }), [height]);

  const zoomScale = useRef<ScaleLinear>(scaleLinear({ domain: [0, 1], range: [0, 1] }));

  usePlayerSubscription(
    (state) => state.player.viewport,
    (viewport) => {
      zoomScale.current.domain(viewport);
    },
    shallow,
  );

  return (
    <div className="grid grid-cols-[298px_1fr] gap-1">
      <div />
      <div
        ref={containerRef}
        className="cursor-pointer items-center flex flex-1 dark:bg-black bg-neutral-100"
        style={{ height }}
      >
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
          <svg
            height={height}
            className="touch-none fill-transparent w-full"
            width={containerBounds.width < 0 ? 0 : containerBounds.width}
          >
            <rect
              ref={activeRegionRef}
              x={xScale(0)}
              width={Math.max(0, containerBounds.width - TIMELINE_PADDING * 2)}
              height={height}
            />

            <TrackBackground tickHeight={height} />

            {/* Gesture Detector */}
            <GestureDetector height={height} />

            <BoundsDisplay />
            <HoverMarker />

            <Playhead />
          </svg>
        </TrackContext.Provider>
      </div>
    </div>
  );
}

export const TrackGap = memo(InnerTrackGap);
