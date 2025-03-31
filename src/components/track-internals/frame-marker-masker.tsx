import { type ReactNode, memo, useRef } from "react";
import { getHexagonPath } from "@semio/utils";
import { motion, useTransform } from "motion/react";
import { useAnimationStore, useTrackContext, useScaleInverseSpring } from "../../hooks";
import { InstancedFrameInfo, TrackRender } from "../../types";

const hexPath = getHexagonPath(0, 15, 12, 15);

export interface FrameMarkerProps {
  data: InstancedFrameInfo;
  ignoreZoom?: boolean;
}
function InnerFrameMarkerMasker({ data, ignoreZoom = false }: FrameMarkerProps): ReactNode {
  const gestureRef = useRef<SVGGElement>();
  const { xScale, trackRender, animationId } = useTrackContext();

  const animationDuration = useAnimationStore(
    (state) => state.animations[animationId].duration ?? 5000,
  );

  const pathRef = useRef<SVGPathElement>(null);

  const inverseScaleSpring = useScaleInverseSpring(ignoreZoom);
  const transformSpring = useTransform(inverseScaleSpring, (scaleSpring) => {
    return `translate(${xScale(data.stamp * animationDuration).toString()} 0) scale(${scaleSpring.toString()} 1)`;
  });

  transformSpring.on("change", (ts) => {
    pathRef.current?.setAttribute("transform", ts);
  });

  if (trackRender !== TrackRender.Key) {
    return null;
  }

  return (
    <motion.path
      ref={pathRef}
      d={hexPath}
      fill="black"
      stroke="black"
      strokeWidth={3}
      transformOrigin="center"
      transform={transformSpring.get()}
    />
  );
}

export const FrameMarkerMasker = memo(InnerFrameMarkerMasker);
