import type { ReactNode, MutableRefObject } from "react";
import { useMemo, useRef } from "react";
import useMeasure from "react-use-measure";
import { closestFrame } from "@semio/utils";
import { scaleLinear } from "@visx/scale";
import { useGesture } from "@use-gesture/react";
import { useShallow } from "zustand/react/shallow";
import { clamp } from "lodash";
import Playhead from "./playhead";
import { TIMELINE_PADDING } from "./constants";
import HoverMarker from "./hover-marker";
import { useAnimationStore } from "./hooks/use-animation-store";
import { AnimationActions, AnimationData } from "./store-types";
import { BoundsDisplay } from "./bounds-display";
import { DataDisplay } from "./data-display";
import { TrackBoundsContext } from "./hooks/use-track-bounds";
import { useHoverSpring } from "./hooks/use-hover-spring";
import { TrackBackground } from "./track-background";
import { ZoomDisplay } from "./zoom-display";
import { useWithZoom } from "./hooks/use-with-zoom";

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
  const gestureRef = useRef<SVGRectElement>();

  const resetPlayer = useAnimationStore(
    useShallow((state: AnimationActions) => state.resetPlayer),
  );

  const framerate = useAnimationStore(
    useShallow((state: AnimationData) => state.framerate as number),
  );
  const duration = useAnimationStore(
    useShallow(
      (state: AnimationData) =>
        state.animations[state.activeAnimation]?.duration ?? 5000,
    ),
  );
  const updatePlayerViewport = useAnimationStore(
    useShallow((state: AnimationActions) => state.updatePlayerViewport),
  );

  const frameCount = Math.floor(framerate * (duration / 1000));

  // console.log(frames) xds
  // const [hovered, setHovered] = useState<boolean>(false);
  // const onHoverStart = () => setHovered(true);
  // const onHoverEnd = () => setHovered(false);
  // const delayedHover = useLazy(hovered, 250);

  const { setHoverpoint, clearHoverpoint } = useHoverSpring();

  const [activeRegionRef, activeRegionBounds] = useMeasure();

  const withZoom = useWithZoom(!canZoom);

  const xScale = useMemo(
    () =>
      scaleLinear({
        domain: [0, 1],
        range: [TIMELINE_PADDING, width - TIMELINE_PADDING],
        // clamp: true,
      }),
    [width],
  );

  const gestureBinding = useGesture({
    onDoubleClick: (state) => {
      // console.log(state);
      withZoom((zoomScale) => {
        const newPosition = clamp(
          zoomScale.invert(
            ((state.event.clientX ?? 0) - activeRegionBounds.left) /
              activeRegionBounds.width,
          ),
          0,
          1,
        );
        if (state.altKey) {
          resetPlayer(newPosition);
        } else {
          const closest: number = closestFrame(newPosition, frameCount);
          resetPlayer(closest);
        }
      });
    },
    onMove: (state) => {
      withZoom((zoomScale) => {
        const newPosition = zoomScale.invert(
          ((state.xy[0] || 0) - activeRegionBounds.left) /
            activeRegionBounds.width,
        );
        if (state.altKey) {
          setHoverpoint(newPosition);
          // setHoveredSpan(getInclusionSpan(frames, newPosition));
        } else {
          const closest: number = closestFrame(newPosition, frameCount);
          setHoverpoint(closest);
          // setHoveredSpan(getInclusionSpan(frames, closest));
        }
      });
    },
  });

  useGesture(
    {
      onHover: (state) => {
        if (!state.hovering) {
          clearHoverpoint();
        }
      },
      onPinch: ({ event, offset: [scale] }) => {
        event.preventDefault();
        event.stopPropagation();
        withZoom((zoomScale) => {
          const newPosition = clamp(
            zoomScale.invert(
              (((event as MouseEvent).clientX ?? 0) - activeRegionBounds.left) /
                activeRegionBounds.width,
            ),
            0,
            1,
          );
          const s = clamp(scale, 1, duration / 1000);
          const newDomainWidth = 1 / s;

          const hp = newPosition;
          const newDomain = [
            hp - newDomainWidth * hp,
            hp + newDomainWidth * (1 - hp),
          ];
          updatePlayerViewport(newDomain[0], newDomain[1]);
        });
      },
    },
    {
      target: gestureRef as MutableRefObject<EventTarget>,
      pinch: {
        scaleBounds: { min: 1, max: duration / 1000 },
        rubberband: true,
      },
    },
  );

  return (
    <TrackBoundsContext.Provider
      value={{
        bounds: activeRegionBounds,
        scale: xScale,
        frameCount,
      }}
    >
      <svg
        height={30}
        className="touch-none fill-transparent w-full"
        width={width < 0 ? 0 : width}
        {...gestureBinding()}
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

        {/* Gesture Detector */}
        <rect
          ref={gestureRef as MutableRefObject<SVGRectElement>}
          x={xScale(0)}
          width={Math.max(0, width - TIMELINE_PADDING * 2)}
          className="h-[30px] touch-none fill-transparent"
        />
      </svg>
    </TrackBoundsContext.Provider>
  );
}
