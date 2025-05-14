import { type ReactNode, memo, useRef } from "react";
import { clsx } from "clsx";
import { useShallow } from "zustand/react/shallow";
import { motion, useTransform } from "motion/react";
import { useHoverSpring, useAnimationStore } from "../../hooks";

export interface HoverMarkerProps {
  ignoreZoom?: boolean;
  height?: number;
  offset?: number;
}

function InnerHoverMarker({
  ignoreZoom = false,
  height = 30,
  offset = 0,
}: HoverMarkerProps): ReactNode {
  const hoverpoint = useHoverSpring(ignoreZoom);
  const dashed = useAnimationStore(useShallow((state) => state.preferences.hoverDashedLine));

  const strokeWidth = useTransform(hoverpoint, (hoverXval) => (hoverXval === undefined ? 0 : 1));
  const transform = useTransform(
    hoverpoint,
    (hoverXval) => `translate(${(hoverXval ?? 0).toString()} 0)`,
  );

  const pathRef = useRef<SVGPathElement>(null);

  transform.on("change", (v) => {
    pathRef.current?.setAttribute("transform", v);
  });

  return (
    <motion.path
      ref={pathRef}
      style={{
        strokeDasharray: dashed ? "5 5" : "none",
        strokeDashoffset: dashed ? "2.5" : "none",
        strokeWidth,
      }}
      className={clsx(
        "touch-none stroke-transparent pointer-events-none",
        "group-hover:stroke-black/50 dark:group-hover:stroke-white/50",
        "aria-selected:stroke-transparent",
      )}
      rx={1}
      // vertical line
      d={`M 0 ${offset.toString()} L 0 ${height.toString()}`}
    />
  );
}

export const HoverMarker = memo(InnerHoverMarker);
