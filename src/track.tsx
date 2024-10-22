import type { ReactNode } from "react";
import { useMemo } from "react";
import useMeasure from "react-use-measure";
import { scaleLinear } from "@visx/scale";
import { useHover } from "@use-gesture/react";
import { useShallow } from "zustand/react/shallow";
import { clsx } from "clsx";
import { Playhead } from "./playhead";
import { TIMELINE_PADDING } from "./constants";
import { HoverMarker } from "./hover-marker";
import { useAnimationStore } from "./hooks/use-animation-store";
import { AnimationData } from "./store-types";
import { BoundsDisplay } from "./bounds-display";
import { GestureDetector } from "./gesture-detector";
import { DataDisplay } from "./data-display";
import { TrackContext } from "./hooks/use-track-context";
import { TrackBackground } from "./track-background";
import { ZoomDisplay } from "./zoom-display";

export interface TrackProps {
  width: number;
  trackIds?: string[];
  canZoom?: boolean;
  showBackground?: boolean;
  showData?: boolean;
  showZoomControls?: boolean;
  useCustomColor?: boolean;
  color?: string;
  emphasis?: boolean;
  onEmphasisChange?: (emphasis: boolean) => void;
}

export function Track({
  width,
  trackIds,
  canZoom = true,
  showBackground = true,
  showData = true,
  showZoomControls = false,
  emphasis = false,
  color = "#737373",
  onEmphasisChange,
}: TrackProps): ReactNode {
  const framerate = useAnimationStore(
    useShallow((state: AnimationData) => state.framerate as number),
  );
  const duration = useAnimationStore(
    useShallow((state: AnimationData) => state.animations[state.activeAnimation]?.duration ?? 5000),
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

  const bind = useHover(({ hovering: h }) => {
    const hovering = h ?? false;
    if (onEmphasisChange) {
      onEmphasisChange(hovering);
    }
  });

  return (
    <TrackContext.Provider
      value={{
        bounds: activeRegionBounds,
        scale: xScale,
        frameCount,
        color,
      }}
    >
      <div
        {...bind()}
        className={clsx("relative h-[30px] w-full group/track", emphasis && "has-emphasis")}
      >
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
          <TrackBackground
            showLine={canZoom && showBackground}
            ignoreZoom={!canZoom}
            tickHeight={30}
            showTicks={canZoom}
            trackIds={trackIds}
          />

          {/* Gesture Detector */}
          <GestureDetector ignoreZoom={!canZoom} />

          <BoundsDisplay ignoreZoom={!canZoom} />
          <HoverMarker ignoreZoom={!canZoom} />
          {!canZoom && <ZoomDisplay />}

          <Playhead ignoreZoom={showZoomControls} />

          <DataDisplay trackIds={trackIds} disabled={!showData} ignoreZoom={!canZoom} />
        </svg>
      </div>
    </TrackContext.Provider>
  );
}
