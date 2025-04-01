import { type ReactNode, useState, memo, useRef } from "react";
import { motion, useTransform, type MotionValue } from "motion/react";
import { Text } from "@visx/text";
import { useGesture } from "@use-gesture/react";
import { clamp } from "lodash";
import { clsx } from "clsx";
import { closestFrame, PlayerActions, PlayerData, usePlayerStore } from "@semio/utils";
import { stampToVisualTime } from "@semio/ui";
import { useShallow } from "zustand/react/shallow";
import {
  useTrackContext,
  useAnimationStore,
  usePlayheadSpring,
  usePlayheadCartPathSpring,
  useAltKeyPressed,
} from "../../hooks";
import { AnimationData } from "../../store-types";
import { DRAG_X_CONFIG } from "../../gesture-config";

export interface PlayheadCartProps {
  side: "top" | "bottom";
  duration: number;
  ignoreZoom?: boolean;
}

function InnerPlayheadCart({ side, ignoreZoom, duration }: PlayheadCartProps): ReactNode {
  const {
    xScale,
    zoomScale,
    bounds: { width: timelineWidth, left: timelineLeft },
    frameCount,
  } = useTrackContext();

  const [hovered, setHovered] = useState(false);

  const resetPlayer = usePlayerStore(useShallow((state: PlayerActions) => state.resetPlayer));

  const seekPlayer = usePlayerStore(
    useShallow((state: PlayerActions) => state.updatePlayerViewportCenter),
  );

  const playheadSpring = usePlayheadSpring(ignoreZoom);

  const { d: playheadCartPath, x } = usePlayheadCartPathSpring(side, duration, ignoreZoom);

  const gRef = useRef<SVGGElement>(null);
  const playheadCartPathRef = useRef<SVGPathElement>(null);

  playheadCartPath.on("change", (d) => {
    playheadCartPathRef.current?.setAttribute("d", d);
  });

  useGesture(
    {
      onDrag: (state) => {
        const newPosition = zoomScale.current.invert(
          clamp(((state.xy[0] || 0) - timelineLeft) / timelineWidth, 0, 1),
        );
        if (state.altKey) {
          resetPlayer(newPosition);
        } else {
          const closest: number = closestFrame(newPosition, frameCount);
          resetPlayer(closest);
        }
      },
      onHover: (state) => {
        setHovered(state.hovering || false);
      },
      onDoubleClick: (state) => {
        seekPlayer();
        state.event.stopPropagation();
      },
    },
    { ...DRAG_X_CONFIG, target: gRef },
  );

  const playerDuration = usePlayerStore((state) => state.player.duration);

  const transform = useTransform(
    playheadSpring,
    (c) =>
      `translate(${clamp(c, xScale(0), xScale(playerDuration)).toString()}  ${side === "top" ? "-3.5" : "3.5"})`,
  );

  transform.on("change", (v) => {
    gRef.current?.setAttribute("transform", v);
  });

  return (
    <motion.g ref={gRef} className="touch-none" transform={transform.get()}>
      {/* Cart path */}
      <motion.path
        ref={playheadCartPathRef}
        d={playheadCartPath}
        className={clsx(
          "touch-none",
          hovered ? "dark:fill-white fill-black" : "dark:fill-neutral-300 fill-neutral-700",
        )}
        y={side === "top" ? 20.5 : 0}
      />
      <PlayheadText side={side} x={x} duration={duration} />
    </motion.g>
  );
}

function PlayheadText({
  side,
  x,
  duration,
}: {
  side: "top" | "bottom";
  x: MotionValue<number>;
  duration: number;
}): ReactNode {
  const framerate = useAnimationStore(useShallow((state: AnimationData) => state.framerate));
  const stamp = usePlayerStore(useShallow((state: PlayerData) => state.player.stamp));
  const timeDisplay = useAnimationStore(useShallow((state: AnimationData) => state.timeDisplay));

  const altPressed = useAltKeyPressed();
  const visualTime = stampToVisualTime(stamp, duration, framerate, timeDisplay, altPressed);

  const transform = useTransform(
    x,
    (value) => `translate(${value.toString()} ${(side === "top" ? 8.5 : 11.5).toString()})`,
  );

  const gRef = useRef<SVGGElement>(null);

  transform.on("change", (v) => {
    gRef.current?.setAttribute("transform", v);
  });

  return (
    <motion.g ref={gRef} transform={transform.get()}>
      <Text
        textAnchor="middle"
        verticalAnchor="start"
        fontSize={10}
        className={clsx("font-mono", "fill-white/75 dark:fill-black/75")}
      >
        {visualTime}
      </Text>
    </motion.g>
  );
}

export const PlayheadCart = memo(InnerPlayheadCart);
