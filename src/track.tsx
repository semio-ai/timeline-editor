import type { ReactNode } from "react";
import { useMemo } from "react";
import useMeasure from "react-use-measure";
import { closestFrame } from "@semio/utils";
import { scaleLinear } from "@visx/scale";
import { useGesture } from "@use-gesture/react";
import { useShallow } from "zustand/react/shallow";
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

export interface TrackProps {
  width: number;
  trackIds?: string[];
  isTop?: boolean;
  isBottom?: boolean;
  canZoom?: boolean;
  showBackground?: boolean;
  showData?: boolean;
  showZoomControls?: boolean;
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
}: TrackProps): ReactNode {
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

  const frameCount = Math.floor(framerate * (duration / 1000));

  // console.log(frames) xds
  // const [hovered, setHovered] = useState<boolean>(false);
  // const onHoverStart = () => setHovered(true);
  // const onHoverEnd = () => setHovered(false);
  // const delayedHover = useLazy(hovered, 250);

  const { setHoverpoint, clearHoverpoint } = useHoverSpring();

  const [activeRegionRef, activeRegionBounds] = useMeasure();

  const viewport = useAnimationStore(
    (state: AnimationData) => state.player.viewport,
  );

  const zoomScale = useMemo(
    () =>
      scaleLinear({
        domain: canZoom ? viewport : [0, 1],
        range: [0, 1],
      }),
    [canZoom, viewport],
  );
  const zoomReferenceScale = useMemo(
    () =>
      scaleLinear({
        domain: viewport,
        range: [0, 1],
      }),
    [viewport],
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

  const gestureBindings = useGesture({
    onDoubleClick: (state) => {
      // console.log(state);
      const newPosition = zoomScale.invert(
        ((state.event.clientX ?? 0) - activeRegionBounds.left) /
          activeRegionBounds.width,
      );
      if (state.altKey) {
        resetPlayer(newPosition);
      } else {
        const closest: number = closestFrame(newPosition, frameCount);
        resetPlayer(closest);
      }
    },
    onHover: (state) => {
      if (!state.hovering) {
        clearHoverpoint();
      }
    },
    onMove: (state) => {
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
    },
  });

  return (
    <TrackBoundsContext.Provider
      value={{
        bounds: activeRegionBounds,
        scale: xScale,
        frameCount,
        zoom: zoomScale,
        zoomReference: zoomReferenceScale,
      }}
    >
      <svg
        height={30}
        className="touch-none fill-transparent w-full"
        width={width < 0 ? 0 : width}
        {...gestureBindings()}
      >
        <rect
          ref={activeRegionRef}
          x={xScale(0)}
          width={Math.max(0, width - TIMELINE_PADDING * 2)}
          className="h-[30px]"
        />
        {showBackground && <TrackBackground showLine={showBackground} />}
        <HoverMarker />
        <BoundsDisplay isTop={isTop} isBottom={isBottom} />
        <Playhead
          isTop={isTop}
          isBottom={isBottom}
          minimap={showZoomControls}
        />
        {!canZoom && <ZoomDisplay />}
        <DataDisplay trackIds={trackIds} disabled={!showData} />
      </svg>
    </TrackBoundsContext.Provider>
  );
}
