import { useEffect } from "react";
import { MotionValue, useMotionValue } from "motion/react";
import { TransitionParams } from "../functions/compute-transition-params";

/**
 * Hook that generates motion values for a transition curve in normalized space (0-1).
 * Returns motion values for the four control points of a cubic Bezier curve.
 */
export function useTransitionCurve(
  transitionParams: TransitionParams,
  yScale: (v: number) => number,
): {
  startX: MotionValue<number>;
  startY: MotionValue<number>;
  endX: MotionValue<number>;
  endY: MotionValue<number>;
  cp1X: MotionValue<number>;
  cp1Y: MotionValue<number>;
  cp2X: MotionValue<number>;
  cp2Y: MotionValue<number>;
} {
  // Time values (X coordinates)
  const startX = useMotionValue(transitionParams.start.x);
  const endX = useMotionValue(transitionParams.end.x);

  // Normalized Y values for transition space
  const startY = useMotionValue(yScale(transitionParams.start.y));
  const endY = useMotionValue(yScale(transitionParams.end.y));

  // controlPoint1
  const cp1X = useMotionValue(transitionParams.cp1.x);
  const cp1Y = useMotionValue(yScale(transitionParams.cp1.y));

  // controlPoint2
  const cp2X = useMotionValue(transitionParams.cp2.x);
  const cp2Y = useMotionValue(yScale(transitionParams.cp2.y));

  useEffect(() => {
    // Update control points based on transition parameters
    cp1X.set(transitionParams.cp1.x);
    cp1Y.set(yScale(transitionParams.cp1.y));
    cp2X.set(transitionParams.cp2.x);
    cp2Y.set(yScale(transitionParams.cp2.y));
    // Update the start/end points
    startX.set(transitionParams.start.x);
    endX.set(transitionParams.end.x);
    startY.set(yScale(transitionParams.start.y));
    endY.set(yScale(transitionParams.end.y));
  }, [transitionParams, yScale, startX, startY, cp1X, cp1Y, cp2X, cp2Y, endX, endY]);

  return { startX, startY, endX, endY, cp1X, cp1Y, cp2X, cp2Y };
}
