import { type ReactNode, useEffect, useState, memo, useContext } from "react";
import { SpringValue, animated } from "@react-spring/web";
import { useGesture } from "@use-gesture/react";
import { clamp } from "lodash";
import {
  closestFrame,
  // getHexagonPath,
  // getDegenerateHexagonPath,
} from "@semio/utils";
import { useShallow } from "zustand/react/shallow";
// import type { ScaleLinear } from "./scale-linear";
import { AnimationContext } from "./context";
import { useTrackBounds } from "./hooks/use-track-bounds";
import { useAnimationStore } from "./hooks/use-animation-store";
import { TIMELINE_PADDING } from "./constants";

export interface PlayheadProps {
  isTop?: boolean;
  isBottom?: boolean;
  minimap?: boolean;
}

function Playhead({
  isTop = true,
  isBottom = true,
  minimap = false,
}: PlayheadProps): ReactNode {
  const {
    scale: xScale,
    zoom: zoomScale,
    zoomReference: zoomRefScale,
    bounds: { width: timelineWidth, left: timelineLeft },
    frameCount,
  } = useTrackBounds();

  const animationState = useContext(AnimationContext);

  const completion = new SpringValue<number>(
    animationState!.getState().player.stamp as number,
  );

  // const playing = useAnimationStore(
  //   useShallow((state) => state.player.running),
  // );
  // const keyed = useAnimationStore(
  //   useShallow((state) => state.selectedKeyframe !== undefined),
  // );

  const [hovered, setHovered] = useState(false);

  // const duration = useAnimationStore(
  //   useShallow((state) => state.duration as number),
  // );
  // const framerate = useAnimationStore(
  //   useShallow((state) => state.framerate as number),
  // );
  // const frameCount = Math.floor(framerate * (duration / 1000));

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

  // const keyedPath = useMemo<string>(
  //   () => getHexagonPath(0, 11, 13.5, 13.5),
  //   [],
  // );

  // const unkeyedPath = useMemo<string>(
  //   () => getDegenerateHexagonPath(0, 11, 15, 15),
  //   [],
  // );

  // const { d } = useSpring({
  //   reverse: playing || !keyed,
  //   from: { d: unkeyedPath },
  //   to: { d: keyedPath },
  //   config: {
  //     duration: 50,
  //   },
  // });

  const gestureBindings = useGesture(
    {
      onDrag: (state) => {
        const newPosition = zoomScale.invert(
          clamp(((state.xy[0] || 0) - timelineLeft) / timelineWidth, 0, 1),
        );
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
    },
    {
      axis: "x",
      drag: {
        filterTaps: true,
        pointer: {
          capture: false,
        },
      },
    },
  );

  return (
    <animated.g
      className="cursor-pointer touch-none"
      style={{
        transform: completion.to(
          (c) => `translateX(${xScale(zoomScale(c)).toString()}px`,
        ),
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
      <path d="M-6 0 L0 3.5 L6 0 Z" className={getStyle(isTop, hovered)} />
      {/* Bottom triangle */}
      <path
        d="M-6 30 L0 26.5 L6 30 Z"
        className={getStyle(isBottom, hovered)}
      />
      {/* Middle Hexagon */}
      {/* <animated.path
          d={d}
          className={clsx(
            "stroke-1",
            "transition-[fill]",
            hovered
              ? "dark:stroke-white stroke-black dark:fill-info-100 fill-info-900"
              : "dark:stroke-neutral-300 stroke-neutral-700 fill-info-500",
          )}
        /> */}
    </animated.g>
  );
}

function getStyle(onBounds: boolean, hovered: boolean): string {
  if (onBounds && hovered) {
    return "dark:fill-white fill-black";
  } else if (onBounds) {
    return "dark:fill-neutral-300 fill-neutral-700";
  } else {
    return "fill-transparent";
  }
}

export default memo(Playhead);
