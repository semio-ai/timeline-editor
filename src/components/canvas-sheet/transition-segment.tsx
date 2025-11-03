import { memo, useMemo, useState, useEffect } from "react";
import { useSpring } from "motion/react";
import { useThree } from "@react-three/fiber";
import { useCursor } from "@react-three/drei";
import { Theme } from "@semio/ui";
import { MotionCubicBezierLine, MotionCubicBezierFill } from "../utilities";
import {
  TrackRender,
  InstancedFrameInfo,
  SourceRow,
  LayerBand,
  VerticalAxisRange,
} from "../../types";
import { computeOklabMix, createLinearScale } from "../../functions";
import { computeTransitionParams } from "../../functions/compute-transition-params";
import { useTransitionCurve, useAnimationStore } from "../../hooks";
import { DEFAULT_COLOR, ROW_DEPTH_EPSILON, Z } from "../../constants";

export interface TransitionSegmentProps {
  start: InstancedFrameInfo;
  end: InstancedFrameInfo;
  sourceRow: SourceRow;
  trackRender: TrackRender;
  height: number;
  verticalBounds?: { min: number; max: number };
  verticalAxisRange?: VerticalAxisRange;
  isEmpty?: boolean;
  theme?: Theme.Light | Theme.Dark;
  color: string;
  layer?: LayerBand;
  onHoverChange?: (hovered: boolean) => void;
  isRowHovered?: boolean;
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
  layer = LayerBand.Background,
  onHoverChange,
  isRowHovered = false,
  verticalAxisRange,
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
  const isSpline = trackRender === TrackRender.Spline;
  const visualScaleFactor = verticalAxisRange?.visualScale ?? 1;
  const visualOffset = verticalAxisRange?.visualOffset ?? 0;
  const splineRange = useMemo(() => {
    if (!isSpline) {
      return { min: 0, max: 0, span: 0 };
    }
    const span = Math.max(height * visualScaleFactor, 1);
    const halfSpan = span / 2;
    return {
      min: -halfSpan + visualOffset,
      max: halfSpan + visualOffset,
      span,
    };
  }, [height, isSpline, visualOffset, visualScaleFactor]);

  const renderScaleY = useMemo(() => {
    if (isSpline) {
      const domainMin = verticalBounds.min;
      const domainMax = verticalBounds.max;
      const domainSpan = domainMax - domainMin;
      if (!Number.isFinite(domainSpan) || domainSpan === 0) {
        return () => splineRange.min;
      }
      return createLinearScale([domainMin, domainMax], [splineRange.min, splineRange.max]);
    }
    if (trackRender === TrackRender.Preview) {
      const min = verticalBounds.min;
      const max = verticalBounds.max;
      if (max === min) {
        return () => 0;
      }
      return createLinearScale([min, max], [-buffer, buffer]);
    }
    return createLinearScale([0, 1], [-buffer, buffer]);
  }, [
    buffer,
    isSpline,
    splineRange.max,
    splineRange.min,
    trackRender,
    verticalBounds.max,
    verticalBounds.min,
  ]);

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

  // Disable y-springs while dragging a segment that includes any selected track
  const selectionState = useAnimationStore((state) => state.selectionState);
  const dragState = useAnimationStore((state) => state.dragState);
  const includesDraggedTrack = useMemo(() => {
    if (!dragState || !selectionState?.keypoints) return false;
    const trackset = new Set<string>(sourceRow.data.map((t) => t.trackId));
    return Array.from(selectionState.keypoints.keys()).some((id) => trackset.has(id));
  }, [sourceRow.data, dragState, selectionState]);

  const mvStartY = includesDraggedTrack ? transitionCurve.startY : startY;
  const mvEndY = includesDraggedTrack ? transitionCurve.endY : endY;
  const mvCp1Y = includesDraggedTrack ? transitionCurve.cp1Y : cp1Y;
  const mvCp2Y = includesDraggedTrack ? transitionCurve.cp2Y : cp2Y;

  // Lookup the z-value based on the layerband
  const z = LAYER_TO_Z[layer];
  // Compute depths for fill and line to avoid z-fighting
  const fillDepth = z - ROW_DEPTH_EPSILON * 0.4;
  const lineDepth = z - ROW_DEPTH_EPSILON * 0.2;
  const clickLine = useAnimationStore((state) => state.clickLine);
  const [isHovered, setIsHovered] = useState(false);
  const isInteractive =
    !isEmpty &&
    (layer === LayerBand.ForegroundSelected || layer === LayerBand.ForegroundUnselected);
  const gl = useThree((s) => s.gl);
  useCursor(isInteractive && isHovered, "pointer", "auto", gl.domElement);

  useEffect(() => {
    if (!isInteractive && isHovered) {
      setIsHovered(false);
    }
  }, [isInteractive, isHovered]);

  useEffect(() => {
    return () => {
      if (isInteractive && isHovered) {
        onHoverChange?.(false);
      }
    };
  }, [isInteractive, isHovered, onHoverChange]);

  const hoverColor = useMemo(
    () => computeOklabMix(bufferColor, theme === Theme.Dark ? "#FFFFFF" : "#000000", 0.4),
    [bufferColor, theme],
  );
  const emphasize = isInteractive && isRowHovered;
  const lineDisplayColor = emphasize ? hoverColor : bufferColor;
  const fillDisplayColor = color;

  const handlePointerEnter = () => {
    if (!isInteractive) return;
    setIsHovered(true);
    onHoverChange?.(true);
  };

  const handlePointerOut = () => {
    if (!isInteractive) return;
    setIsHovered(false);
    onHoverChange?.(false);
  };

  return (
    <group>
      {(trackRender === TrackRender.Preview || trackRender === TrackRender.Transition) &&
        !isEmpty && (
          <MotionCubicBezierFill
            start={{
              x: transitionCurve.startX,
              y: mvStartY,
            }}
            end={{
              x: transitionCurve.endX,
              y: mvEndY,
            }}
            controlPoint1={{
              x: transitionCurve.cp1X,
              y: mvCp1Y,
            }}
            controlPoint2={{
              x: transitionCurve.cp2X,
              y: mvCp2Y,
            }}
            baseline={-height * 0.4}
            baselineExtension={height * 0.1}
            color={fillDisplayColor}
            opacity={0.5}
            segments={50}
            z={fillDepth}
            // This doesn't seem to help with the visibility either way?
            // renderOrder={RenderOrder.TransitionFill}
          />
        )}
      <group
        onPointerEnter={handlePointerEnter}
        onPointerOut={handlePointerOut}
        onClick={(event) => {
          if (!isInteractive) return;
          console.log();
          event?.stopPropagation?.();
          clickLine(
            sourceRow.id,
            `${start.id}:${end.id}`,
            event.shiftKey,
            event.metaKey || event.ctrlKey,
          );
        }}
      >
        <MotionCubicBezierLine
          start={{
            x: transitionCurve.startX,
            y: mvStartY,
          }}
          end={{
            x: transitionCurve.endX,
            y: mvEndY,
          }}
          controlPoint1={{
            x: transitionCurve.cp1X,
            y: mvCp1Y,
          }}
          controlPoint2={{
            x: transitionCurve.cp2X,
            y: mvCp2Y,
          }}
          color={lineDisplayColor}
          lineWidth={lineWidth + (isRowHovered ? 0.5 : 0)}
          opacity={isEmpty && trackRender === TrackRender.Transition ? 0.0 : 1.0}
          transparent
          dashed={false}
          segments={50}
          z={isEmpty ? fillDepth : lineDepth}
          // This doesn't seem to help with the visibility either way?
          // renderOrder={isEmpty ? RenderOrder.TransitionFill : RenderOrder.TransitionLine}
        />
        <MotionCubicBezierLine
          start={{
            x: transitionCurve.startX,
            y: mvStartY,
          }}
          end={{
            x: transitionCurve.endX,
            y: mvEndY,
          }}
          controlPoint1={{
            x: transitionCurve.cp1X,
            y: mvCp1Y,
          }}
          controlPoint2={{
            x: transitionCurve.cp2X,
            y: mvCp2Y,
          }}
          color={DEFAULT_COLOR}
          lineWidth={8}
          opacity={0}
          transparent
          dashed={false}
          segments={20}
          z={isEmpty ? fillDepth : lineDepth}
          // This doesn't seem to help with the visibility either way?
          // renderOrder={isEmpty ? RenderOrder.TransitionFill : RenderOrder.TransitionLine}
        />
      </group>
    </group>
  );
});

const LAYER_TO_Z: Record<LayerBand, Z> = {
  [LayerBand.Background]: Z.BackgroundData,
  [LayerBand.ForegroundUnselected]: Z.ForegroundDataUnselected,
  [LayerBand.ForegroundSelected]: Z.ForegroundDataSelected,
};
