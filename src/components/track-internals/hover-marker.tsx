import { type ReactNode, memo, useRef } from "react";
import { clsx } from "clsx";
import { useShallow } from "zustand/react/shallow";
import { motion, useTransform } from "motion/react";
import { useHoverSpring, useAnimationStore, useTrackContext } from "../../hooks";

export interface HoverMarkerProps {
  ignoreZoom?: boolean;
}

function InnerHoverMarker({ ignoreZoom = false }: HoverMarkerProps): ReactNode {
  const {
    bounds: { height },
  } = useTrackContext();
  const hoverpoint = useHoverSpring(ignoreZoom);
  const dashed = useAnimationStore(useShallow((state) => state.preferences.hoverDashedLine));

  const strokeWidth = useTransform(hoverpoint, (hoverXval) => (hoverXval === undefined ? 0 : 1));
  const transform = useTransform(
    hoverpoint,
    (hoverXval) => `translate(${(hoverXval ?? 0).toString()} 0)`,
  );

  const pathRef = useRef<SVGLineElement>(null);

  transform.on("change", (v) => {
    pathRef.current?.setAttribute("transform", v);
  });

  return (
    <motion.line
      ref={pathRef}
      style={{
        strokeDasharray: dashed ? "5 5" : "none",
        strokeDashoffset: dashed ? "2.5" : "none",
        strokeWidth,
      }}
      className={clsx(
        "touch-none stroke-transparent pointer-events-none",
        "group-hover/sheet:stroke-black/50 dark:group-hover/sheet:stroke-white/50",
        "aria-selected:stroke-transparent",
      )}
      rx={1}
      x1={0}
      x2={0}
      y1={0}
      y2={height ?? 0}
    />
  );
}

export const HoverMarker = memo(InnerHoverMarker);
