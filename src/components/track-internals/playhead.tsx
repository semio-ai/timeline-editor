import { type ReactNode, memo, useRef, useMemo } from "react";
import { clsx } from "clsx";
import { useTransform } from "motion/react";
import { useGesture } from "@use-gesture/react";
import { clamp } from "lodash";
import { closestFrame, usePlayerStore } from "@semio/utils";
import { useShallow } from "zustand/react/shallow";
import { useTrackContext, useAnimationStore } from "../../hooks";
import { usePlayheadSpring } from "../../hooks/use-playhead-spring_orig";
import { DRAG_X_CONFIG } from "../../gesture-config";
import { SemanticTime } from "../../types";

export interface PlayheadProps {
  ignoreZoom?: boolean;
}

function InnerPlayhead({ ignoreZoom = false }: PlayheadProps): ReactNode {
  const {
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

  const { resetPlayer, playing } = usePlayerStore(
    useShallow((state) => ({ resetPlayer: state.resetPlayer, playing: state.player.running })),
  );

  const playheadSpring = usePlayheadSpring(ignoreZoom);

  const gRef = useRef<SVGGElement>(null);

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
        if (state.hovering) {
          if (!previewCurrent) {
            addPreview({ semanticTime: SemanticTime.Current, stamp: 0, label: "Current" });
          }
        } else {
          removePreview((p) => p.semanticTime === SemanticTime.Current);
        }
      },
    },
    { ...DRAG_X_CONFIG, target: gRef },
  );

  const transform = useTransform(playheadSpring, (value) => `translate(${value.toString()} 0)`);

  transform.on("change", (v) => {
    gRef.current?.setAttribute("transform", v);
  });

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
    <g ref={gRef} transform={transform.get()} className="touch-none">
      {/* This is an element that makes a slightly larger hitbox */}
      <rect x={-2.5} y={0} width={5} height={timelineHeight} className="fill-transparent" />

      <path
        d={`M 0 0 L 0 ${timelineHeight.toString()}`}
        className={lineColorClassName}
        strokeWidth={2}
      />
    </g>
  );
}

export const Playhead = memo(InnerPlayhead);
