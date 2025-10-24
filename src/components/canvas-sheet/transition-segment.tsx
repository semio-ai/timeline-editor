import { memo, useMemo } from "react";
import { useSpring } from "motion/react";
import { Theme } from "@semio/ui";
import { MotionCubicBezierLine, MotionCubicBezierFill } from "../utilities";
import { TrackRender, InstancedFrameInfo, SourceRow, LayerBand, SourceRowData } from "../../types";
import { computeOklabMix, createLinearScale } from "../../functions";
import { computeTransitionParams } from "../../functions/compute-transition-params";
import { useTransitionCurve } from "../../hooks";
import { ROW_DEPTH_EPSILON, LAYER_BAND_PRIORITY, RenderOrder, Z } from "../../constants";

export interface TransitionSegmentProps {
  start: InstancedFrameInfo;
  end: InstancedFrameInfo;
  sourceRow: SourceRow;
  trackRender: TrackRender;
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
export const TransitionSegment = memo(function TransitionSegment({
  start,
  end,
  trackRender,
  height,
  verticalBounds = { min: 0, max: 1 },
  sourceRow,
  isEmpty = false,
  color,
  theme,
}: TransitionSegmentProps) {
  // Determine line thickness based on track render mode
  const lineWidth = useMemo(() => {
    if (trackRender === TrackRender.Key) return 2.5;
    // if (trackRender === TrackRender.Spline) return 2;
    return 2; // For Preview, Transition and Spline
  }, [trackRender]);

  const transitionParams = useMemo(
    () => computeTransitionParams(sourceRow, start, end, isEmpty, trackRender, verticalBounds),
    [sourceRow, start, end, isEmpty, trackRender, verticalBounds],
  );

  const buffer = height * 0.4;

  const renderScaleY = useMemo(() => {
    if (trackRender === TrackRender.Preview || trackRender === TrackRender.Spline) {
      const min = verticalBounds.min;
      const max = verticalBounds.max;
      if (max === min) {
        return () => 0;
      }
      return createLinearScale([min, max], [-buffer, buffer]);
    }
    return createLinearScale([0, 1], [-buffer, buffer]);
  }, [buffer, trackRender, verticalBounds.min, verticalBounds.max]);

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

  const resolveFrameBand = (points: SourceRowData[]): LayerBand => {
    return points.reduce<LayerBand>((current, point) => {
      return LAYER_BAND_PRIORITY[point.layerBand] > LAYER_BAND_PRIORITY[current]
        ? point.layerBand
        : current;
    }, LayerBand.Background);
  };

  // Base the placement on the highest priority band of the two endpoints
  const band = resolveFrameBand([...start.points, ...end.points]);

  // Lookup the z-value based on the layerband
  const z = LAYER_TO_Z[band];
  // Compute depths for fill and line to avoid z-fighting
  const fillDepth = z - ROW_DEPTH_EPSILON * 0.2;
  const lineDepth = z + ROW_DEPTH_EPSILON * 0.2;

  return (
    <group
      onClick={() => console.log("transition-segment", transitionParams, sourceRow, start, end)}
    >
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
            z={fillDepth}
            // This doesn't seem to help with the visibility either way?
            // renderOrder={RenderOrder.TransitionFill}
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
        z={isEmpty ? fillDepth : lineDepth}
        // This doesn't seem to help with the visibility either way?
        // renderOrder={isEmpty ? RenderOrder.TransitionFill : RenderOrder.TransitionLine}
      />
    </group>
  );
});

const LAYER_TO_Z: Record<LayerBand, Z> = {
  [LayerBand.Background]: Z.BackgroundData,
  [LayerBand.ForegroundUnselected]: Z.ForegroundDataUnselected,
  [LayerBand.ForegroundSelected]: Z.ForegroundDataSelected,
};
