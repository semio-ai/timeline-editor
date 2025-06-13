import { type ReactNode, useState, memo, useRef, useMemo } from "react";
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
  useAltKeyPressed,
} from "../../hooks";
import { AnimationData } from "../../store-types";
import { VERTICAL_POINTER_PATH, HORIZONTAL_POINTER_PATH, TRANSITION_CONFIG } from "../../constants";
import { DRAG_X_CONFIG } from "../../gesture-config";
import { usePlayheadCartSprings } from "../../hooks/use-playhead-cart-springs";
import { SemanticTime } from "../../types";

export interface PlayheadCartProps {
  side: "top" | "bottom";
  duration: number;
  ignoreZoom?: boolean;
}

function InnerPlayheadCart({ side, ignoreZoom, duration }: PlayheadCartProps): ReactNode {
  const {
    xScale,
    zoomScale,
    bounds: { width: timelineWidth, left: timelineLeft, height: timelineHeight },
    frameCount,
  } = useTrackContext();

  const [previewCurrent, removePreview, addPreview] = useAnimationStore(
    useShallow((state) => [
      state.previews.find((p) => p.semanticTime === SemanticTime.Current) !== undefined,
      state.removePreview,
      state.addPreview,
    ]),
  );

  const { resetPlayer, seekPlayer } = usePlayerStore(
    useShallow((state: PlayerActions) => ({
      resetPlayer: state.resetPlayer,
      seekPlayer: state.updatePlayerViewportCenter,
    })),
  );
  const { playerDuration, playing } = usePlayerStore(
    useShallow((state) => ({
      playerDuration: state.player.duration,
      playing: state.player.running,
    })),
  );

  const playheadSpring = usePlayheadSpring(ignoreZoom);

  const {
    width: widthSpring,
    offset: offsetSpring,
    visibility: visibilitySpring,
  } = usePlayheadCartSprings(duration, 10, ignoreZoom);

  const gRef = useRef<SVGGElement>(null);
  const playheadCartBoxRef = useRef<SVGRectElement>(null);

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
      onDoubleClick: (state) => {
        seekPlayer();
        state.event.stopPropagation();
      },
      onHover: (state) => {
        if (state.hovering) {
          if (!previewCurrent) {
            addPreview({ semanticTime: SemanticTime.Current, stamp: 0, label: "Current" });
          }
        } else {
          removePreview((p) => p.semanticTime === SemanticTime.Current);
        }
      },
    },
    { ...DRAG_X_CONFIG, target: gRef, enabled: !playing },
  );

  const transform = useTransform(
    playheadSpring,
    (c) => `translate(${clamp(c, xScale(0), xScale(playerDuration)).toString()} 0)`,
  );

  const [pointerMode, setPointerMode] = useState<"horizontal" | "vertical">("vertical");

  visibilitySpring.on("change", (v) => {
    if (Math.abs(v) > 0.5) {
      setPointerMode("horizontal");
    } else {
      setPointerMode("vertical");
    }
  });

  transform.on("change", (v) => {
    gRef.current?.setAttribute("transform", v);
  });

  const colorClassName = useMemo(() => {
    return clsx(
      "touch-none transition-colors duration-75",
      playing ? "cursor-not-allowed" : "cursor-pointer",
      playing && "fill-neutral-500",
      !playing && !previewCurrent && "dark:fill-neutral-300 fill-neutral-700",
      !playing && previewCurrent && "dark:fill-white fill-black",
    );
  }, [playing, previewCurrent]);

  const lineColorClassName = useMemo(() => {
    return clsx(
      "touch-none transition-colors duration-75",
      playing ? "cursor-not-allowed" : "cursor-pointer",
      playing && "stroke-neutral-500",
      !playing && !previewCurrent && "dark:stroke-neutral-300 stroke-neutral-700",
      !playing && previewCurrent && "dark:stroke-white stroke-black",
    );
  }, [playing, previewCurrent]);

  return (
    <motion.g ref={gRef} className="touch-none group/cart" transform={transform.get()}>
      {/* Create a path that creates a rounded box with a caret on the bottom */}
      <motion.g
        transform={`translate(0 ${side === "top" ? "2" : "31"}) rotate(${side === "top" ? "0" : "180"})`}
      >
        {/* This is the vertical pointer. It expands when there is at least 0 pixels on either side of the cart */}
        <motion.g
          variants={{
            vertical: { transform: "scale(1)" },
            horizontal: { transform: "scale(0)" },
          }}
          animate={pointerMode}
          transition={TRANSITION_CONFIG}
        >
          <path d={VERTICAL_POINTER_PATH} className={colorClassName} />
        </motion.g>
        {/* This is the horizontal pointer. It expands horizontally when there is less than 0 pixels on either side of the cart */}
        <motion.g
          variants={{
            vertical: { transform: "scale(0 1)" },
            horizontal: { transform: "scale(1 1)" },
          }}
          animate={pointerMode}
          transition={TRANSITION_CONFIG}
        >
          <path d={HORIZONTAL_POINTER_PATH} className={colorClassName} />
        </motion.g>
      </motion.g>

      {/* Cart path */}
      <motion.rect
        x={offsetSpring}
        y={side === "top" ? 2 : 11}
        width={widthSpring}
        height={20}
        rx={2}
        ref={playheadCartBoxRef}
        className={colorClassName}
      />
      <motion.line
        x1={0}
        x2={0}
        strokeWidth={2}
        initial={{
          y1: side === "top" ? 2 : 0,
          y2: side === "top" ? timelineHeight : timelineHeight - 2,
        }}
        variants={{
          vertical: {
            y1: side === "top" ? 2 : 0,
            y2: side === "top" ? timelineHeight : timelineHeight - 2,
          },
          horizontal: { y1: side === "top" ? 2 : 0, y2: side === "top" ? 2 : 0 },
        }}
        animate={pointerMode}
        className={lineColorClassName}
      />

      <PlayheadText
        side={side}
        offsetSpring={offsetSpring}
        widthSpring={widthSpring}
        duration={duration}
      />
    </motion.g>
  );
}

function PlayheadText({
  side,
  offsetSpring,
  widthSpring,
  duration,
}: {
  side: "top" | "bottom";
  offsetSpring: MotionValue<number>;
  widthSpring: MotionValue<number>;
  duration: number;
}): ReactNode {
  const framerate = useAnimationStore(useShallow((state: AnimationData) => state.framerate));
  const stamp = usePlayerStore(useShallow((state: PlayerData) => state.player.stamp));
  const timeDisplay = useAnimationStore(useShallow((state: AnimationData) => state.timeDisplay));

  const altPressed = useAltKeyPressed();
  const visualTime = stampToVisualTime(stamp, duration, framerate, timeDisplay, altPressed);

  const transform = useTransform(
    () =>
      `translate(${(offsetSpring.get() + widthSpring.get() / 2).toString()} ${(side === "top" ? 8 : 16).toString()})`,
  );

  const gRef = useRef<SVGGElement>(null);

  transform.on("change", (v) => {
    gRef.current?.setAttribute("transform", v);
  });

  return (
    <motion.g ref={gRef} transform={transform}>
      <Text
        textAnchor="middle"
        verticalAnchor="start"
        fontSize={10}
        className={clsx("font-mono cursor-pointer", "fill-white/75 dark:fill-black/75")}
      >
        {visualTime}
      </Text>
    </motion.g>
  );
}

export const PlayheadCart = memo(InnerPlayheadCart);
