import { memo, useMemo, useEffect } from "react";
import { useMotionValue, animate } from "motion/react";
import { AnimatableValue } from "@semio/utils";
import { Theme } from "@semio/ui";
import { MotionCubicBezierLine, MotionCubicBezierFill } from "../utilities";
import { TrackRender, InstancedFrameInfo } from "../../../types";

export interface TransitionSegmentProps {
  start: InstancedFrameInfo;
  end: InstancedFrameInfo;
  trackIds: string[];
  trackRender: TrackRender;
  trackType: AnimatableValue["type"] | "multiple";
  attribute?: string;
  height: number;
  verticalBounds?: { min: number; max: number };
  isBuffer?: boolean;
  theme?: Theme.Light | Theme.Dark;
  color: string;
}

/**
 * TransitionSegment renders animated cubic Bezier curves between animation frames.
 *
 * The component supports different rendering modes:
 * - **Preview/Transition mode**: Renders both a filled area below the curve and the curve line
 * - **Key mode**: Renders only a thick line (no fill)
 * - **Spline mode**: Renders the curve with fill (similar to Preview)
 * - **Buffer mode**: Renders a dashed line with reduced opacity (no fill)
 *
 * The fill area extends from the cubic Bezier curve down to a baseline calculated as
 * `-height * 0.4`, creating a visual representation of the interpolated values over time.
 * The fill uses the same motion value system as the line, ensuring perfect synchronization
 * during animations.
 *
 * Key features:
 * - High-performance BufferGeometry-based fill implementation
 * - Spring-animated Y positions with immediate X position updates
 * - Shared motion values between line and fill for perfect synchronization
 * - Z-layered rendering (fill at z=1, line at z=2)
 * - Conditional fill rendering based on track render mode and buffer state
 */
function InnerTransitionSegment({
  start,
  end,
  trackIds,
  trackRender,
  trackType,
  attribute,
  height,
  verticalBounds = { min: 0, max: 1 },
  isBuffer = false,
  color,
}: TransitionSegmentProps) {
  // Use stamp values directly as x coordinates
  const startTime = start.stamp;
  const endTime = end.stamp;

  // Determine line thickness based on track render mode
  const lineWidth = useMemo(() => {
    if (trackRender === TrackRender.Key) return 4;
    return 1.5; // For Preview, Transition and Spline
  }, [trackRender]);

  // Calculate start and end values based on track render mode
  const { startY, endY, hasSimpleValues } = useMemo(() => {
    if (trackRender === TrackRender.Key) {
      return { startY: 0, endY: 0, hasSimpleValues: true };
    }

    if (trackRender === TrackRender.Transition) {
      // Normalized transition space with some buffer
      const buffer = height * 0.4;
      return {
        startY: -buffer,
        endY: buffer,
        hasSimpleValues: true,
      };
    }

    // For Preview and Spline modes, extract actual values
    if (trackIds.length === 1 && start.points.length === 1 && end.points.length === 1) {
      let startValue: number | undefined;
      let endValue: number | undefined;

      if (trackType === "number") {
        startValue = start.points[0].value as number;
        endValue = end.points[0].value as number;
      } else if (["vector3", "euler", "rgb", "hsl"].includes(trackType) && attribute) {
        const startObj = start.points[0].value as unknown as Record<string, number>;
        const endObj = end.points[0].value as unknown as Record<string, number>;
        startValue = startObj?.[attribute];
        endValue = endObj?.[attribute];
      }

      if (typeof startValue === "number" && typeof endValue === "number") {
        // Apply padding similar to transition view
        const buffer = height * 0.4;
        const scale = createLinearScale(
          [verticalBounds.min, verticalBounds.max],
          [-buffer, buffer],
        );
        return {
          startY: scale(startValue),
          endY: scale(endValue),
          hasSimpleValues: true,
        };
      }
    }

    // Fallback for multiple tracks or complex values
    return { startY: height / 2, endY: height / 2, hasSimpleValues: false };
  }, [trackRender, trackIds, start, end, trackType, attribute, height, verticalBounds]);

  // Calculate control points based on transitions and render mode
  const { cp1X, cp1Y, cp2X, cp2Y } = useMemo(() => {
    const timeRange = endTime - startTime;

    if (trackRender === TrackRender.Key || !hasSimpleValues || timeRange === 0) {
      // Simple linear interpolation
      const midTime = startTime + timeRange / 2;
      return {
        cp1X: midTime,
        cp1Y: startY,
        cp2X: midTime,
        cp2Y: endY,
      };
    }

    if (trackRender === TrackRender.Transition) {
      // Debug: Log transition data
      console.log("Transition data debug:", {
        startTransitions: start.transitions,
        endTransitions: end.transitions,
        startId: start.id,
        endId: end.id,
      });

      // Use transition control points in normalized space with cubic ease-in-out defaults
      const outTransition = start.transitions?.out
        ? ([start.transitions.out.x, start.transitions.out.y] as [number, number])
        : ([0.65, 0] as [number, number]); // cubic ease-in-out out
      const inTransition = end.transitions?.in
        ? ([end.transitions.in.x, end.transitions.in.y] as [number, number])
        : ([0.35, 1] as [number, number]); // cubic ease-in-out in

      return {
        cp1X: startTime + outTransition[0] * timeRange,
        cp1Y: startY + outTransition[1] * (endY - startY),
        cp2X: startTime + inTransition[0] * timeRange,
        cp2Y: startY + inTransition[1] * (endY - startY),
      };
    }

    // For Preview and Spline modes with cubic ease-in-out defaults
    const outTransition = start.transitions?.out
      ? ([start.transitions.out.x, start.transitions.out.y] as [number, number])
      : ([0.65, 0] as [number, number]); // cubic ease-in-out out
    const inTransition = end.transitions?.in
      ? ([end.transitions.in.x, end.transitions.in.y] as [number, number])
      : ([0.35, 1] as [number, number]); // cubic ease-in-out in

    // Control points should influence the curve shape in value space
    const yRange = Math.abs(endY - startY);
    const cp1YOffset = outTransition[1] * yRange * 0.5;
    const cp2YOffset = inTransition[1] * yRange * 0.5;

    return {
      cp1X: startTime + outTransition[0] * timeRange,
      cp1Y: startY + (endY > startY ? cp1YOffset : -cp1YOffset),
      cp2X: startTime + inTransition[0] * timeRange,
      cp2Y: endY + (endY > startY ? -cp2YOffset : cp2YOffset),
    };
  }, [
    trackRender,
    hasSimpleValues,
    startTime,
    endTime,
    startY,
    endY,
    start.transitions,
    end.transitions,
    start.id,
    end.id,
  ]);

  // Create persistent motion values
  const startX = useMotionValue(startTime);
  const startYMotion = useMotionValue(startY);
  const endX = useMotionValue(endTime);
  const endYMotion = useMotionValue(endY);
  const controlPoint1X = useMotionValue(cp1X);
  const controlPoint1Y = useMotionValue(cp1Y);
  const controlPoint2X = useMotionValue(cp2X);
  const controlPoint2Y = useMotionValue(cp2Y);

  // Update motion values - X positions immediately, Y positions with spring animation
  useEffect(() => {
    startX.set(startTime);
  }, [startX, startTime]);

  useEffect(() => {
    void animate(startYMotion, startY, { type: "spring", stiffness: 300, damping: 30 });
  }, [startYMotion, startY]);

  useEffect(() => {
    endX.set(endTime);
  }, [endX, endTime]);

  useEffect(() => {
    void animate(endYMotion, endY, { type: "spring", stiffness: 300, damping: 30 });
  }, [endYMotion, endY]);

  useEffect(() => {
    controlPoint1X.set(cp1X);
  }, [controlPoint1X, cp1X]);

  useEffect(() => {
    void animate(controlPoint1Y, cp1Y, { type: "spring", stiffness: 300, damping: 30 });
  }, [controlPoint1Y, cp1Y]);

  useEffect(() => {
    controlPoint2X.set(cp2X);
  }, [controlPoint2X, cp2X]);

  useEffect(() => {
    void animate(controlPoint2Y, cp2Y, { type: "spring", stiffness: 300, damping: 30 });
  }, [controlPoint2Y, cp2Y]);

  return (
    <>
      {(trackRender === TrackRender.Preview || trackRender === TrackRender.Transition) &&
        !isBuffer && (
          <MotionCubicBezierFill
            start={{
              x: startX,
              y: startYMotion,
            }}
            end={{
              x: endX,
              y: endYMotion,
            }}
            controlPoint1={{
              x: controlPoint1X,
              y: controlPoint1Y,
            }}
            controlPoint2={{
              x: controlPoint2X,
              y: controlPoint2Y,
            }}
            baseline={-height * 0.4}
            baselineExtension={height * 0.1}
            color={color}
            opacity={0.5}
            segments={50}
            z={1}
          />
        )}
      <MotionCubicBezierLine
        start={{
          x: startX,
          y: startYMotion,
        }}
        end={{
          x: endX,
          y: endYMotion,
        }}
        controlPoint1={{
          x: controlPoint1X,
          y: controlPoint1Y,
        }}
        controlPoint2={{
          x: controlPoint2X,
          y: controlPoint2Y,
        }}
        color={color}
        lineWidth={lineWidth}
        opacity={isBuffer ? 0.5 : 1.0}
        transparent
        dashed={isBuffer}
        segments={50}
        z={2}
        onPointerOver={() => {
          console.log("Pointer over transition segment", {
            startX: startX.get(),
            startY: startYMotion.get(),
            endX: endX.get(),
            endY: endYMotion.get(),
            cp1X: controlPoint1X.get(),
            cp1Y: controlPoint1Y.get(),
            cp2X: controlPoint2X.get(),
            cp2Y: controlPoint2Y.get(),
            verticalBounds,
            start,
            end,
            isBuffer,
            trackRender,
            trackType,
            attribute,
          });
        }}
      />
    </>
  );
}

export const TransitionSegment = memo(InnerTransitionSegment);

// Create a linear scale function
const createLinearScale = (domain: [number, number], range: [number, number]) => {
  const [domainMin, domainMax] = domain;
  const [rangeMin, rangeMax] = range;
  const domainRange = domainMax - domainMin;
  const outputRange = rangeMax - rangeMin;

  return (value: number) => {
    const normalized = (value - domainMin) / domainRange;
    return rangeMin + normalized * outputRange;
  };
};
