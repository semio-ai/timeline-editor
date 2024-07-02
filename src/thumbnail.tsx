import { type ReactNode, useEffect, useMemo, useState, memo } from "react";
import { SpringValue, animated, useSpring, easings } from "@react-spring/web";
import {
  useStudioStore,
  useStudioStoreState,
  type StudioStore,
} from "@semio/core";
import { useGesture } from "@use-gesture/react";
import { closestFrame, getHexagonPath } from "@semio/utils";
import { useShallow } from "zustand/react/shallow";
import type { ScaleLinear } from "./scale-linear";

export interface ThumbnailProps {
  xScale: ScaleLinear;
  timelineWidth: number;
  timelineLeft: number;
}

function Thumbnail({
  xScale,
  timelineWidth,
  timelineLeft,
}: ThumbnailProps): ReactNode {
  useEffect(() => {
    console.log("thumbnail prop xScale updated");
  }, [xScale]);

  useEffect(() => {
    console.log("thumbnail prop timelineLeft updated");
  }, [timelineLeft]);

  useEffect(() => {
    console.log("thumbnail prop timelineWidth updated");
  }, [timelineWidth]);

  const studioState = useStudioStoreState();
  // useEffect(() => {
  //   console.log("thumbnail props updated");
  // }, [xScale, activeRegionBounds]);

  const completion = new SpringValue<number>(
    studioState.getState().timer.stamp as number,
  );

  const [hovered, setHovered] = useState(false);

  const duration = useStudioStore(
    useShallow((state: StudioStore) => state.animation.duration as number),
  );
  const framerate = useStudioStore(
    useShallow((state: StudioStore) => state.animation.framerate as number),
  );
  const frameCount = Math.floor(framerate * (duration / 1000));

  type resetTimerType = (time?: number | undefined) => void;

  const resetTimer = useStudioStore(
    useShallow((state: StudioStore) => state.resetTimer as resetTimerType),
  );

  useEffect(() => {
    studioState.subscribe(
      (state: StudioStore) => state.timer.stamp as number,
      (s: number) => {
        // console.log("setting time", s);
        completion.set(s);
        completion;
      },
    );
  });

  const hoveredPath = useMemo<string>(
    () => getHexagonPath(xScale(0) - 7, 11, 15, 22),
    [xScale],
  );

  const unhoveredPath = useMemo<string>(
    () => getHexagonPath(xScale(0) - 7, 11, 10, 22),
    [xScale],
  );

  const { d } = useSpring({
    reverse: hovered,
    from: { d: hoveredPath },
    to: { d: unhoveredPath },
    config: {
      duration: 50,
      easing: easings.easeInOutCubic,
    },
  });

  const gestureBindings = useGesture({
    onDrag: (state) => {
      const newPosition = ((state.xy[0] || 0) - timelineLeft) / timelineWidth;
      if (state.shiftKey) {
        resetTimer(newPosition);
      } else {
        const closest: number = closestFrame(newPosition, frameCount);
        resetTimer(closest);
      }
    },
    onHover: (state) => {
      setHovered(state.hovering || false);
    },
  });

  return (
    <animated.path
      {...gestureBindings()}
      style={{
        touchAction: "none",
        transform: completion.to((c) => `translateX(${xScale(c).toString()}px`),
      }}
      strokeWidth={2}
      stroke="var(--mantine-color-body)"
      strokeOpacity={1}
      fill="var(--mantine-color-semioBlue-7)"
      fillOpacity={1}
      rx={1}
      d={d}
      height={10}
      width={10}
    />
  );
}

export default memo(Thumbnail);
