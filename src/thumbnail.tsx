import {
  type ReactNode,
  useEffect,
  useMemo,
  useState,
  memo,
  useContext,
} from "react";
import { SpringValue, animated, useSpring, easings } from "@react-spring/web";
import { useGesture } from "@use-gesture/react";
import { closestFrame, getHexagonPath } from "@semio/utils";
import { useShallow } from "zustand/react/shallow";
import type { ScaleLinear } from "./scale-linear";
import { AnimationContext } from "./context";
import { useAnimationStore } from "./hooks/use-animation-store";

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

  const animationState = useContext(AnimationContext);
  // useEffect(() => {
  //   console.log("thumbnail props updated");
  // }, [xScale, activeRegionBounds]);

  const completion = new SpringValue<number>(
    animationState?.getState().player.stamp as number,
  );

  const [hovered, setHovered] = useState(false);

  const duration = useAnimationStore(
    useShallow((state) => state.duration as number),
  );
  const framerate = useAnimationStore(
    useShallow((state) => state.framerate as number),
  );
  const frameCount = Math.floor(framerate * (duration / 1000));

  const resetPlayer = useAnimationStore(
    useShallow((state) => state.resetPlayer),
  );

  useEffect(() => {
    if (!animationState) {
      return;
    }
    const unsub = animationState.subscribe(
      (state) => state.player.stamp as number,
      (s: number) => {
        // console.log("setting time", s);
        completion.set(s);
        completion;
      },
    );
    return unsub;
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
        resetPlayer(newPosition);
      } else {
        const closest: number = closestFrame(newPosition, frameCount);
        resetPlayer(closest);
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
      className="fill-tertiary-500 dark:stroke-neutral-950 stroke-neutral-500 stroke-2"
      rx={1}
      d={d}
      height={10}
      width={10}
    />
  );
}

export default memo(Thumbnail);
