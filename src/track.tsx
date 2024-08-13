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

export interface TrackProps {
  width: number;
  trackIds?: string[];
  isTop?: boolean;
  isBottom?: boolean;
}

export function Track({
  width,
  trackIds,
  isTop = true,
  isBottom = true,
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

  const xScale = useMemo(
    () =>
      scaleLinear({
        domain: [0, 1],
        range: [TIMELINE_PADDING, width - TIMELINE_PADDING],
        clamp: true,
      }),
    [width],
  );

  const gestureBindings = useGesture({
    onDoubleClick: (state) => {
      // console.log(state);
      const newPosition =
        ((state.event.clientX ?? 0) - activeRegionBounds.left) /
        (activeRegionBounds.width - TIMELINE_PADDING);
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
      const newPosition =
        ((state.xy[0] || 0) - activeRegionBounds.left) /
        (activeRegionBounds.width - TIMELINE_PADDING);
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
      value={{ bounds: activeRegionBounds, scale: xScale, frameCount }}
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
          width={Math.max(0, xScale(1))}
          className="h-[30px]"
        />
        <TrackBackground />
        <HoverMarker />
        <BoundsDisplay isTop={isTop} isBottom={isBottom} />
        <Playhead isTop={isTop} isBottom={isBottom} />
        <DataDisplay trackIds={trackIds} />
      </svg>
    </TrackBoundsContext.Provider>
  );
}
