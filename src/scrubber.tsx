/* eslint-disable @typescript-eslint/no-unsafe-return -- Fixme*/
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { useStudioStore, type StudioStore, type Keyframe } from "@semio/core";
import useMeasure from "react-use-measure";
import { pairwise, useLazy, closestFrame } from "@semio/utils";
import { useClickOutside, useDisclosure } from "@mantine/hooks";
import { animated, useSpringValue, useSpring } from "@react-spring/web";
import { scaleLinear } from "@visx/scale";
import { useGesture } from "@use-gesture/react";
import { useShallow } from "zustand/react/shallow";
import Landmark from "./landmark";
import Segment from "./segment";
import Thumbnail from "./thumbnail";
import { TIMELINE_PADDING } from "./constants";
import HoverMarker from "./hover-marker";

export interface ScrubberProps {
  width: number;
  editorOpened: boolean;
}

export function Scrubber({ width, editorOpened }: ScrubberProps): ReactNode {
  const frames: Keyframe[] = useStudioStore(
    useShallow(
      (state: StudioStore) =>
        // Array.from(state.animation.frames.values())
        state.animation.frameOrder
          .map((id: string) => state.animation.frames.get(id))
          // Just in case, filter out any undefined frames
          .filter(
            // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents -- Fixme
            (item: Keyframe | undefined) => item !== undefined,
          ) as Keyframe[],
    ),
  );

  type resetTimerType = (time?: number | undefined) => void;
  const resetTimer = useStudioStore(
    useShallow((state: StudioStore) => state.resetTimer as resetTimerType),
  );

  // console.log("frames", frames);

  const framerate = useStudioStore(
    useShallow((state: StudioStore) => state.animation.framerate as number),
  );
  const duration = useStudioStore(
    useShallow((state: StudioStore) => state.animation.duration as number),
  );

  const frameCount = Math.floor(framerate * (duration / 1000));

  // console.log(frames) xds

  const [hovered, { open: onHoverStart, close: onHoverEnd }] = useDisclosure();
  const delayedHover = useLazy(hovered, 1000);

  const hoverPoint = useSpringValue<number>(0, { config: { duration: 0 } });

  // const duration = useStudioStore((state) => state.animation.duration);
  const [hoveredSpan, setHoveredSpan] = useState<number[] | null>(null);
  const [activeSpan, setActiveSpan] = useState<number[] | null>([0, 0]);

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

  const scrubberRef = useClickOutside(() => {
    onHoverEnd();
    setHoveredSpan(null);
  });

  const styles = useSpring({
    height: hovered || editorOpened || delayedHover ? 22 : 5,
    y: hovered || editorOpened || delayedHover ? 0 : 8.5,
    color:
      hovered || editorOpened || delayedHover
        ? "transparent"
        : "var(--mantine-color-gray-6)",
    config: { duration: 100 },
  });

  const gestureBindings = useGesture({
    onDrag: (state) => {
      const newPosition =
        ((state.xy[0] || 0) - activeRegionBounds.left) /
        activeRegionBounds.width;
      hoverPoint.set(newPosition);
      setHoveredSpan(getInclusionSpan(frames, newPosition));
      if (state.altKey) {
        resetTimer(newPosition);
        setActiveSpan(getInclusionSpan(frames, newPosition));
      } else {
        const closest: number = closestFrame(newPosition, frameCount);
        resetTimer(closest);
        setActiveSpan(getInclusionSpan(frames, closest));
      }
    },
    onHover: (state) => {
      if (state.hovering) {
        onHoverStart();
      } else {
        onHoverEnd();
        setHoveredSpan(null);
      }
    },
    onMove: (state) => {
      const newPosition =
        ((state.xy[0] || 0) - activeRegionBounds.left) /
        activeRegionBounds.width;
      if (state.altKey) {
        hoverPoint.set(newPosition);
        setHoveredSpan(getInclusionSpan(frames, newPosition));
      } else {
        const closest: number = closestFrame(newPosition, frameCount);
        hoverPoint.set(closest);
        setHoveredSpan(getInclusionSpan(frames, closest));
      }
    },
  });

  return (
    <animated.svg
      ref={scrubberRef}
      style={{ touchAction: "none" }}
      height={22}
      width={width < 0 ? 0 : width}
      {...gestureBindings()}
    >
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="0%">
          <animated.stop offset="0%" stopColor="var(--mantine-color-gray-6)" />
          <animated.stop
            offset={hoverPoint.to(
              (hp) => `${Math.max(0, hp * 100 - 20).toString()}%`,
            )}
            stopColor="var(--mantine-color-gray-6)"
          />
          <animated.stop
            offset={hoverPoint.to((hp) => `${(hp * 100).toString()}%`)}
            stopColor={styles.color}
          />
          <animated.stop
            offset={hoverPoint.to(
              (hp) => `${Math.min(100, hp * 100 + 20).toString()}%`,
            )}
            stopColor="var(--mantine-color-gray-6)"
          />
          <animated.stop
            offset="100%"
            stopColor="var(--mantine-color-gray-6)"
          />
        </linearGradient>
      </defs>
      {/* Create a rect frame for use for measurements */}
      <animated.rect
        ref={activeRegionRef}
        x={TIMELINE_PADDING}
        y={styles.y}
        width={Math.max(0, innerWidth)}
        height={styles.height}
        fill="url(#bg)"
      />
      {pairwise(Array.from({ length: frameCount + 1 }, (v, i) => i)).map(
        ([frame1, frame2]) => (
          <Segment
            end={frame2 / frameCount}
            key={`${frame1.toString()}-${frame2.toString()}`}
            parentActive={hovered || editorOpened || delayedHover}
            start={frame1 / frameCount}
            xScale={xScale}
            inHoveredSpan={
              (hoveredSpan &&
                frame1 / frameCount >= hoveredSpan[0] &&
                frame2 / frameCount <= hoveredSpan[1])!
            }
            inActiveSpan={
              (activeSpan &&
                frame1 / frameCount >= activeSpan[0] &&
                frame2 / frameCount <= activeSpan[1])!
            }
          />
        ),
      )}
      <HoverMarker
        xScale={xScale}
        timelineWidth={activeRegionBounds.width}
        timelineLeft={activeRegionBounds.left}
        hoverX={hoverPoint}
        parentActive={hovered || editorOpened || delayedHover}
      />
      {Object.values(frames).map((frame) => {
        return (
          <Landmark
            key={frame.id}
            time={frame.stamp}
            xScale={xScale}
            parentActive={hovered || editorOpened || delayedHover}
          />
        );
      })}
      <Thumbnail
        xScale={xScale}
        timelineWidth={activeRegionBounds.width}
        timelineLeft={activeRegionBounds.left}
      />
    </animated.svg>
  );
}

function getInclusionSpan(frames: Keyframe[], hoverX: number): number[] {
  // get the largest frame that is less than the hoverX
  const firstStamp: number =
    frames.toReversed().find((frame) => frame.stamp <= hoverX)?.stamp || 0;

  // get the smallest frame that is greater than the hoverX
  const secondStamp: number =
    frames.find((frame) => frame.stamp >= hoverX)?.stamp || 0;

  return [firstStamp, secondStamp];
}
