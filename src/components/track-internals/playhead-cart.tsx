import { type ReactNode, useState, memo } from "react";
import { animated, SpringValue } from "@react-spring/web";
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
  ignoreZoom?: boolean;
}

function InnerPlayheadCart({ side, ignoreZoom }: PlayheadCartProps): ReactNode {
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

  const { d: playheadCartPath, x } = usePlayheadCartPathSpring(side, ignoreZoom);

  const gestureBindings = useGesture(
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
    DRAG_X_CONFIG,
  );

  return (
    <animated.g
      className="touch-none"
      {...gestureBindings()}
      style={{
        transform: playheadSpring.to(
          (c) =>
            `translate(${clamp(xScale(c), xScale(0), xScale(1)).toString()}px, ${side === "top" ? "-3.5" : "3.5"}px)`,
        ),
      }}
    >
      {/* Cart path */}
      <animated.path
        d={playheadCartPath}
        className={clsx(
          "touch-none",
          hovered ? "dark:fill-white fill-black" : "dark:fill-neutral-300 fill-neutral-700",
        )}
        y={side === "top" ? 20.5 : 0}
      />
      <PlayheadText side={side} x={x} />
    </animated.g>
  );
}

function PlayheadText({ side, x }: { side: "top" | "bottom"; x: SpringValue<number> }): ReactNode {
  const duration = useAnimationStore(
    useShallow((state: AnimationData) => state.animations[state.activeAnimation].duration),
  );
  const framerate = useAnimationStore(useShallow((state: AnimationData) => state.framerate));
  const stamp = usePlayerStore(useShallow((state: PlayerData) => state.player.stamp));
  const timeDisplay = useAnimationStore(useShallow((state: AnimationData) => state.timeDisplay));

  const altPressed = useAltKeyPressed();
  const visualTime = stampToVisualTime(stamp, duration, framerate, timeDisplay, altPressed);

  return (
    <animated.g
      style={{
        transform: x.to(
          (c) => `translate(${c.toString()}px, ${(side === "top" ? 8.5 : 11.5).toString()}px)`,
        ),
      }}
    >
      <Text
        textAnchor="middle"
        verticalAnchor="start"
        fontSize={10}
        className={clsx("font-mono", "fill-white/75 dark:fill-black/75")}
      >
        {visualTime}
      </Text>
    </animated.g>
  );
}

export const PlayheadCart = memo(InnerPlayheadCart);
