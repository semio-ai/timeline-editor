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

export interface TrackProps {
  width: number;
  editorOpened: boolean;
  trackIds?: string[];
}

export function Track({
  width,
  editorOpened,
  trackIds,
}: TrackProps): ReactNode {
  const { resolvedTheme } = useTheme();

  const resetPlayer = useAnimationStore(
    useShallow((state: AnimationActions) => state.resetPlayer),
  );

  const framerate = useAnimationStore(
    useShallow((state: AnimationData) => state.framerate as number),
  );
  const duration = useAnimationStore(
    useShallow((state: AnimationData) => state.duration as number),
  );

  const frameCount = Math.floor(framerate * (duration / 1000));

  // console.log(frames) xds
  const [hovered, setHovered] = useState<boolean>(false);
  const onHoverStart = () => setHovered(true);
  const onHoverEnd = () => setHovered(false);
  const delayedHover = useLazy(hovered, 250);

  const { setHoverpoint, hoverpoint } = useHoverSpring();

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

  const bgColor = resolvedTheme === Theme.Dark ? "#525252" : "#a3a3a3";
  const highlightColor = resolvedTheme === Theme.Dark ? "#a3a3a3" : "#525252";

  const styles = useSpring({
    color: hovered || editorOpened ? highlightColor : bgColor,
    config: { duration: 75, easing: easings.easeInOutCubic },
  });

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
      if (state.hovering) {
        onHoverStart();
      } else {
        onHoverEnd();
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
      <animated.svg
        // ref={scrubberRef}
        //
        height={30}
        className="touch-none fill-neutral-500/0 w-full"
        width={width < 0 ? 0 : width}
        {...gestureBindings()}
      >
        <defs>
          <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="0%">
            <animated.stop offset="0%" stopColor={bgColor} />
            <animated.stop
              offset={hoverpoint.to(
                (hp) => `${Math.max(0, hp * 100 - 20).toString()}%`,
              )}
              stopColor={bgColor}
            />
            <animated.stop
              offset={hoverpoint.to((hp) => `${(hp * 100).toString()}%`)}
              stopColor={styles.color}
            />
            <animated.stop
              offset={hoverpoint.to(
                (hp) => `${Math.min(100, hp * 100 + 20).toString()}%`,
              )}
              stopColor={bgColor}
            />
            <animated.stop offset="100%" stopColor={bgColor} />
          </linearGradient>
        </defs>
        {/* Create a rect frame for use for measurements */}
        <animated.rect
          x={TIMELINE_PADDING}
          width={Math.max(0, innerWidth)}
          // height={styles.height}
          // fill="url(#bg)"
          className={clsx(
            "transition-[fill,transform] duration-75",
            "fill-neutral-400 dark:fill-neutral-600 h-[7.5px] translate-y-[11.25px]",
            "group-aria-expanded:fill-[url(#bg)] group-hover:fill-[url(#bg)]",
            "group-aria-expanded:h-[32px] group-hover:h-[32px] group-aria-expanded:translate-y-0 group-hover:translate-y-0",
          )}
        />
        <animated.rect
          ref={activeRegionRef}
          x={TIMELINE_PADDING}
          // y={styles.y}
          width={Math.max(0, innerWidth)}
          // height={styles.height}
          className="h-[30px]"
          // fill="url(#bg)"
        />
        {pairwise(Array.from({ length: frameCount + 1 }, (_v, i) => i)).map(
          ([frame1, frame2]) => (
            <Segment
              end={frame2 / frameCount}
              key={`${frame1.toString()}-${frame2.toString()}`}
              parentActive={hovered || editorOpened || delayedHover}
              start={frame1 / frameCount}
            />
          ),
        )}
        <HoverMarker hoverX={hoverpoint} />
        <BoundsDisplay parentActive={hovered || editorOpened || delayedHover} />
        <Playhead />
        <DataDisplay trackIds={trackIds} />
      </animated.svg>
    </TrackBoundsContext.Provider>
  );
}
