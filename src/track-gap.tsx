import { memo, useMemo } from "react";
import { scaleLinear } from "@visx/scale";
import useMeasure from "react-use-measure";
import { useShallow } from "zustand/react/shallow";
import { TrackContext } from "./hooks/use-track-context";
import { useAnimationStore } from "./hooks/use-animation-store";
import { TrackBackground } from "./track-background";
import { GestureDetector } from "./gesture-detector";
import { BoundsDisplay } from "./bounds-display";
import { HoverMarker } from "./hover-marker";
import { Playhead } from "./playhead";
import { TIMELINE_PADDING } from "./constants";
import { type AnimationData } from "./store-types";

export function InnerTrackGap({ count }: { count: number }) {
  const height = 30 * count;

  const framerate = useAnimationStore(
    useShallow((state: AnimationData) => state.framerate as number),
  );
  const duration = useAnimationStore(
    useShallow((state: AnimationData) => state.animations[state.activeAnimation]?.duration ?? 5000),
  );

  const frameCount = Math.floor(framerate * (duration / 1000));

  const [containerRef, containerBounds] = useMeasure();
  const [activeRegionRef, activeRegionBounds] = useMeasure();

  const xScale = useMemo(
    () =>
      scaleLinear({
        domain: [0, 1],
        range: [TIMELINE_PADDING, containerBounds.width - TIMELINE_PADDING],
      }),
    [containerBounds.width],
  );

  return (
    <div className="w-full flex flex-row items-center" style={{ height }}>
      <div className="w-[calc(100vw-40px)] xs:w-64 transition-[width]" style={{ height }} />
      <div
        ref={containerRef}
        className="cursor-pointer items-center flex flex-1"
        style={{ height }}
      >
        <TrackContext.Provider
          value={{
            bounds: activeRegionBounds,
            scale: xScale,
            frameCount,
            color: "#737373",
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
            <HoverMarker height={height} />

            <Playhead height={height} />
          </svg>
        </TrackContext.Provider>
      </div>
    </div>
  );
}

export const TrackGap = memo(InnerTrackGap);
