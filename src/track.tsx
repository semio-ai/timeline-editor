import type { ReactNode } from "react";
import { useMemo } from "react";
import useMeasure from "react-use-measure";
import { scaleLinear } from "@visx/scale";
import { useShallow } from "zustand/react/shallow";
import { Playhead } from "./playhead";
import { TIMELINE_PADDING } from "./constants";
import { HoverMarker } from "./hover-marker";
import { useAnimationStore } from "./hooks/use-animation-store";
import { AnimationData } from "./store-types";
import { BoundsDisplay } from "./bounds-display";
import { GestureDetector } from "./gesture-detector";
import { DataDisplay } from "./data-display";
import { TrackBoundsContext } from "./hooks/use-track-bounds";
import { TrackBackground } from "./track-background";
import { ZoomDisplay } from "./zoom-display";

export interface TrackProps {
  width: number;
  trackIds?: string[];
  isTop?: boolean;
  isBottom?: boolean;
  canZoom?: boolean;
  showBackground?: boolean;
  showData?: boolean;
  showZoomControls?: boolean;
  useCustomColor?: boolean;
}

export function Track({
  width,
  trackIds,
  isTop = true,
  isBottom = true,
  canZoom = true,
  showBackground = true,
  showData = true,
  showZoomControls = false,
  useCustomColor = false,
}: TrackProps): ReactNode {
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

  const [activeRegionRef, activeRegionBounds] = useMeasure();

  const xScale = useMemo(
    () =>
      scaleLinear({
        domain: [0, 1],
        range: [TIMELINE_PADDING, width - TIMELINE_PADDING],
      }),
    [width],
  );

  return (
    <TrackBoundsContext.Provider
      value={{
        bounds: activeRegionBounds,
        scale: xScale,
        frameCount,
      }}
    >
      <div className="relative h-[30px] w-full">
        <svg
          height={30}
          className="touch-none fill-transparent w-full"
          width={width < 0 ? 0 : width}
        >
          <rect
            ref={activeRegionRef}
            x={xScale(0)}
            width={Math.max(0, width - TIMELINE_PADDING * 2)}
            className="h-[30px]"
          />
          {canZoom && (
            <TrackBackground showLine={showBackground} ignoreZoom={false} />
          )}

          {/* Gesture Detector */}
          <GestureDetector ignoreZoom={!canZoom} />

          <BoundsDisplay
            isTop={isTop}
            isBottom={isBottom}
            ignoreZoom={!canZoom}
          />
          <HoverMarker ignoreZoom={!canZoom} />
          {!canZoom && <ZoomDisplay />}

          <Playhead ignoreZoom={showZoomControls} />

          <DataDisplay
            trackIds={trackIds}
            disabled={!showData}
            ignoreZoom={!canZoom}
            useCustomColor={useCustomColor}
          />
        </svg>
      </div>
    </TrackBoundsContext.Provider>
  );
}
