import { memo, useMemo, useState, useEffect, useRef } from "react";
import { useSpring } from "motion/react";
import { useThree } from "@react-three/fiber";
import { useCursor } from "@react-three/drei";
import { Theme } from "@semio/ui";
import { MotionCubicBezierLine, MotionCubicBezierFill } from "../utilities";
import { TrackRender, SourceRow, LayerBand, VerticalAxisRange, InstancePair } from "../../types";
import { computeOklabMix } from "../../functions";
import { computeTransitionParams } from "../../functions/compute-transition-params";
import { useTransitionCurve, useAnimationStore } from "../../hooks";
import { DEFAULT_COLOR, ROW_DEPTH_EPSILON } from "../../constants";
import { computeRenderScale } from "./utils/render-scale";
import { getLayerZ } from "./utils/layers";

export interface TransitionSegmentProps {
  segment: InstancePair;
  sourceRow: SourceRow;
  trackRender: TrackRender;
  height: number;
  verticalBounds?: { min: number; max: number };
  verticalAxisRange?: VerticalAxisRange;
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
  trackRender,
  height,
  verticalBounds = { min: 0, max: 1 },
  sourceRow,
  segment,
  color,
  theme,
  layer = LayerBand.Background,
  onHoverChange,
  isRowHovered = false,
  verticalAxisRange,
}: TransitionSegmentProps) {
  const start = segment.start;
  const end = segment.end;
  const isEmpty = Boolean(segment.buffer);

  // Determine line thickness based on track render mode
  const lineWidth = useMemo(() => {
    if (trackRender === TrackRender.Key) return 2.5;
    // if (trackRender === TrackRender.Spline) return 2;
    return 2; // For Preview, Transition and Spline
  }, [trackRender]);

  const transitionParams = useMemo(() => {
    if (
      trackRender === TrackRender.Preview ||
      trackRender === TrackRender.Transition ||
      trackRender === TrackRender.Spline
    ) {
      const geometryParams = segment.geometry?.effective?.renderParams?.[trackRender];
      if (geometryParams) {
        return geometryParams;
      }
    }
    // Fallback for Key mode (not precomputed) or legacy segments without geometry.
    return computeTransitionParams(sourceRow, start, end, isEmpty, trackRender, verticalBounds);
  }, [segment.geometry, sourceRow, start, end, isEmpty, trackRender, verticalBounds]);

  const { renderScaleY } = useMemo(
    () =>
      computeRenderScale({
        trackRender,
        height,
        verticalBounds,
        verticalAxisRange,
      }),
    [trackRender, height, verticalBounds, verticalAxisRange],
  );

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
  const z = getLayerZ(layer);
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

  // Suppress line clicks immediately after a drag ends
  const justFinishedDraggingRef = useRef(false);
  useEffect(() => {
    if (!dragState && justFinishedDraggingRef.current) {
      const timer = setTimeout(() => {
        justFinishedDraggingRef.current = false;
      }, 100);
      return () => clearTimeout(timer);
    }
    if (dragState) {
      justFinishedDraggingRef.current = true;
    }
  }, [dragState]);

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
          // Ignore clicks that immediately follow a drag end
          if (justFinishedDraggingRef.current) {
            event?.stopPropagation?.();
            return;
          }
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
