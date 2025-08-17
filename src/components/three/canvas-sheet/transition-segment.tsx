import { memo, useMemo } from "react";
import { useSpring } from "motion/react";
import { AnimatableValue } from "@semio/utils";
import { Theme } from "@semio/ui";
import { MotionCubicBezierLine, MotionCubicBezierFill } from "../utilities";
import { TrackRender, InstancedFrameInfo } from "../../../types";
import { computeOklabMix, createLinearScale } from "../../../functions";
import { computeTransitionParams } from "../../../functions/compute-transition-params";
import { useTransitionCurve } from "../../../hooks";

export interface TransitionSegmentProps {
  start: InstancedFrameInfo;
  end: InstancedFrameInfo;
  trackIds: string[];
  trackRender: TrackRender;
  trackType: AnimatableValue["type"] | "multiple";
  attribute?: string;
  height: number;
  verticalBounds?: { min: number; max: number };
  isEmpty?: boolean;
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
  isEmpty = false,
  color,
  theme,
}: TransitionSegmentProps) {
  // Determine line thickness based on track render mode
  const lineWidth = useMemo(() => {
    if (trackRender === TrackRender.Key) return 4;
    return 1.5; // For Preview, Transition and Spline
  }, [trackRender]);

  const transitionParams = useMemo(
    () =>
      computeTransitionParams(
        trackIds,
        start,
        end,
        isEmpty,
        trackRender,
        trackType,
        verticalBounds,
        attribute,
      ),
    [trackIds, start, end, isEmpty, trackRender, trackType, verticalBounds, attribute],
  );

  const buffer = height * 0.4;

  const renderScaleY = useMemo(() => createLinearScale([0, 1], [-buffer, buffer]), [buffer]);

  // Calculate buffer color using theme-based mixing
  const bufferColor = useMemo(() => {
    if (!isEmpty) return color;
    return computeOklabMix(color, theme === Theme.Dark ? "#202020" : "#EFEFEF", 0.4);
  }, [isEmpty, color, theme]);

  // Get normalized transition curve motion values
  const transitionCurve = useTransitionCurve(transitionParams, renderScaleY);

  // Create spring values for the y-values
  const startY = useSpring(transitionCurve.startY, { stiffness: 300, damping: 30 });
  const endY = useSpring(transitionCurve.endY, { stiffness: 300, damping: 30 });
  const cp1Y = useSpring(transitionCurve.cp1Y, { stiffness: 300, damping: 30 });
  const cp2Y = useSpring(transitionCurve.cp2Y, { stiffness: 300, damping: 30 });

  return (
    <>
      {(trackRender === TrackRender.Preview || trackRender === TrackRender.Transition) &&
        !isEmpty && (
          <MotionCubicBezierFill
            start={{
              x: transitionCurve.startX,
              y: startY,
            }}
            end={{
              x: transitionCurve.endX,
              y: endY,
            }}
            controlPoint1={{
              x: transitionCurve.cp1X,
              y: cp1Y,
            }}
            controlPoint2={{
              x: transitionCurve.cp2X,
              y: cp2Y,
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
          x: transitionCurve.startX,
          y: startY,
        }}
        end={{
          x: transitionCurve.endX,
          y: endY,
        }}
        controlPoint1={{
          x: transitionCurve.cp1X,
          y: cp1Y,
        }}
        controlPoint2={{
          x: transitionCurve.cp2X,
          y: cp2Y,
        }}
        color={bufferColor}
        lineWidth={lineWidth}
        opacity={isEmpty && trackRender === TrackRender.Transition ? 0.0 : 1.0}
        transparent
        dashed={false}
        segments={50}
        z={isEmpty ? 0 : 2}
      />
    </>
  );
}

export const TransitionSegment = memo(InnerTransitionSegment);
