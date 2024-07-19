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
import { clsx } from "clsx";
import {
  closestFrame,
  getHexagonPath,
  getDegenerateHexagonPath,
} from "@semio/utils";
import { useShallow } from "zustand/react/shallow";
import { computeStamps } from "./actions/compute-stamps";
import type { ScaleLinear } from "./scale-linear";
import { AnimationContext } from "./context";
import { useAnimationStore } from "./hooks/use-animation-store";
import { AnimationStore } from "./store";

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
  // useEffect(() => {
  //   console.log("thumbnail prop xScale updated");
  // }, [xScale]);

  // useEffect(() => {
  //   console.log("thumbnail prop timelineLeft updated");
  // }, [timelineLeft]);

  // useEffect(() => {
  //   console.log("thumbnail prop timelineWidth updated");
  // }, [timelineWidth]);
  //

  const animationState = useContext(AnimationContext);
  // useEffect(() => {
  //   console.log("thumbnail props updated");
  // }, [xScale, activeRegionBounds]);

  const completion = new SpringValue<number>(
    animationState!.getState().player.stamp as number,
  );

  // const keyed = useAnimationStore(
  //   useShallow((state) => {
  //     return computeStamps(state, state.visualizedAnimations).includes(
  //       state.player.stamp,
  //     );
  //   }),
  // );

  const playing = useAnimationStore(
    useShallow((state) => state.player.running),
  );
  const keyed = useAnimationStore(
    useShallow((state) => state.selectedKeyframe !== undefined),
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

  const keyedPath = useMemo<string>(() => getHexagonPath(0, 11, 10, 10), []);

  const unkeyedPath = useMemo<string>(
    () => getDegenerateHexagonPath(0, 11, 10, 10),
    [],
  );

  // const unhoveredPath = `M${(-5).toString()} 1 L${(0).toString()} 10 L${(5).toString()} 1 Z`;
  // const hoveredPath = `M${(-7).toString()} 1 L${(0).toString()} 14 L${(7).toString()} 1 Z`;

  const { d } = useSpring({
    reverse: playing || !keyed,
    from: { d: unkeyedPath },
    to: { d: keyedPath },
    config: {
      duration: 50,
      // easing: easings.easeInOutCubic,
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
    <animated.g
      className="cursor-pointer touch-none"
      style={{
        transform: completion.to((c) => `translateX(${xScale(c).toString()}px`),
        filter: "drop-shadow(0px 0px 2px rgba(0, 0, 0, 0.5))",
      }}
      {...gestureBindings()}
    >
      <rect
        x={-10}
        y={-10}
        width={20}
        height={20}
        className="fill-transparent"
      />
      {/* Top triangle */}
      <path
        d="M-5 0 L0 7 L5 0 Z"
        className={
          hovered
            ? "dark:fill-white fill-black"
            : "dark:fill-neutral-300 fill-neutral-700"
        }
      />
      {/* Bottom triangle */}
      <path
        d="M-5 22 L0 15 L5 22 Z"
        className={
          hovered
            ? "dark:fill-white fill-black"
            : "dark:fill-neutral-300 fill-neutral-700"
        }
      />
      {/* Middle Hexagon */}
      <animated.path
        d={d}
        className={clsx(
          keyed ? "stroke-2" : "stroke-1",
          "transition-[stroke,fill]",
          hovered
            ? "dark:stroke-white stroke-black dark:fill-info-100 fill-info-900"
            : "dark:stroke-neutral-300 stroke-neutral-700 fill-info-500",
        )}
      />
      {/* <animated.path
        className={clsx(
          "transition-[d,color] fill-tertiary-500 dark:stroke-neutral-950 stroke-neutral-500 stroke-2 hover:fill-tertiary-50 text-shadow-sm",
        )}
        rx={1}
        d={d}
        height={10}
        width={10}
      /> */}
    </animated.g>
  );
}

export default memo(Thumbnail);
