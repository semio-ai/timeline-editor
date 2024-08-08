import type { CSSProperties, ReactNode } from "react";
import { useMemo, useState } from "react";
import useMeasure from "react-use-measure";
import { pairwise, useLazy, closestFrame } from "@semio/utils";
import { Theme, useTheme } from "@semio/ui";
import { animated, easings, useSpring } from "@react-spring/web";
import { scaleLinear } from "@visx/scale";
import { useGesture } from "@use-gesture/react";
import { useShallow } from "zustand/react/shallow";
import { clsx } from "clsx";
import Segment from "./segment";
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
  const { resolvedTheme } = useTheme();

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

  const innerWidth = width - TIMELINE_PADDING * 2;

  // const bgColor = "#737373"; //Theme.Dark ? "#525252" : "#a3a3a3";
  // const bgColor = resolvedTheme === Theme.Light ? "#262626" : "#e5e5e5";
  // const highlightColor = resolvedTheme === Theme.Dark ? "#a3a3a3" : "#525252";

  // const styles = useSpring({
  //   color: hovered || editorOpened ? highlightColor : bgColor,
  //   config: { duration: 75, easing: easings.easeInOutCubic },
  // });

  const gestureBindings = useGesture({
    onDoubleClick: (state) => {
      console.log(state);
      const newPosition =
        ((state.event.clientX ?? 0) - activeRegionBounds.left) /
        activeRegionBounds.width;
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
        activeRegionBounds.width;
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
        {/*

        */}
      </svg>
    </TrackBoundsContext.Provider>
  );
}
