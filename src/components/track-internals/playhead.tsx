import { type ReactNode, useState, memo, useRef } from "react";
import { useTransform } from "motion/react";
import { useGesture } from "@use-gesture/react";
import { clamp } from "lodash";
import { closestFrame, usePlayerStore } from "@semio/utils";
import { useShallow } from "zustand/react/shallow";
import { useTrackContext, usePlayheadSpring } from "../../hooks";
import { DRAG_X_CONFIG } from "../../gesture-config";

export interface PlayheadProps {
  ignoreZoom?: boolean;
}

function InnerPlayhead({ ignoreZoom = false }: PlayheadProps): ReactNode {
  const {
    zoomScale,
    bounds: { width: timelineWidth, left: timelineLeft, height: timelineHeight },
    frameCount,
  } = useTrackContext();

  const [hovered, setHovered] = useState(false);

  const resetPlayer = usePlayerStore(useShallow((state) => state.resetPlayer));

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
        setHovered(state.hovering || false);
      },
    },
    { ...DRAG_X_CONFIG, target: gRef },
  );

  const transform = useTransform(playheadSpring, (value) => `translate(${value.toString()} 0)`);

  transform.on("change", (v) => {
    gRef.current?.setAttribute("transform", v);
  });

  return (
    <g ref={gRef} transform={transform.get()}>
      {/* This is an element that makes a slightly larger hitbox */}
      <rect x={-2.5} y={0} width={5} height={timelineHeight} className="fill-transparent" />

      <path d={`M 0 0 L 0 ${timelineHeight.toString()}`} className={getStyle(hovered)} />
    </g>
  );
}

function getStyle(hovered: boolean): string {
  if (hovered) {
    return "stroke-2 dark:stroke-white stroke-black";
  } else {
    return "stroke-2 dark:stroke-neutral-300 stroke-neutral-700";
  }
}

export const Playhead = memo(InnerPlayhead);
