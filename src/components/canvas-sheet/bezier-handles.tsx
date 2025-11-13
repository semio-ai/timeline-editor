import { memo, useState } from "react";
import { Line } from "@react-three/drei";
import { useMotionValueEvent } from "motion/react";
import { Theme } from "@semio/ui";
import {
  InstancePair,
  InstancedFrameInfo,
  LayerBand,
  TrackRender,
  VerticalAxisRange,
  WorldCP,
} from "../../types";
import { useInvariantScale } from "../../hooks";
import { ROW_DEPTH_EPSILON } from "../../constants";
import { computeRenderScale } from "./utils/render-scale";
import { getLayerZ } from "./utils/layers";

interface HandlePoint {
  line: [number, number, number];
  marker: [number, number, number];
}

interface BezierHandlesProps {
  segment: InstancePair;
  height: number;
  verticalBounds: { min: number; max: number };
  verticalAxisRange?: VerticalAxisRange;
  color: string;
  layer: LayerBand;
  isHighlighted?: boolean;
  theme?: Theme.Light | Theme.Dark;
}

const RAW_RADIUS_PX = 4;

export const BezierHandles = memo(function BezierHandles({
  segment,
  height,
  verticalBounds,
  verticalAxisRange,
  color,
  layer,
  isHighlighted = false,
  theme = Theme.Light,
}: BezierHandlesProps) {
  const invariantScale = useInvariantScale();
  const [scaleValue, setScaleValue] = useState(() => invariantScale.get());
  useMotionValueEvent(invariantScale, "change", setScaleValue);

  const geometry = segment.geometry;
  if (!geometry || segment.buffer) {
    return null;
  }

  const backgroundColor = theme === Theme.Dark ? "#050505" : "#F7F7F7";
  const startHasExplicitOut = Boolean(segment.start.transitions?.out);
  const endHasExplicitIn = Boolean(segment.end.transitions?.in);

  const { renderScaleY } = computeRenderScale({
    trackRender: TrackRender.Spline,
    height,
    verticalBounds,
    verticalAxisRange,
  });

  const zBase = getLayerZ(layer);
  const connectorDepth = zBase - ROW_DEPTH_EPSILON * 0.05;
  const rawHandleDepth = zBase - ROW_DEPTH_EPSILON * 0.1;
  const effectiveHandleDepth = zBase - ROW_DEPTH_EPSILON * 0.08;

  const rawRenderParams = geometry.raw?.renderParams?.[TrackRender.Spline];
  const effectiveRenderParams =
    geometry.effective?.renderParams?.[TrackRender.Spline] ?? rawRenderParams;

  const cp1Raw = geometry.raw?.controlPoints?.cp1;
  const cp1Effective = geometry.effective?.controlPoints?.cp1;
  const cp2Raw = geometry.raw?.controlPoints?.cp2;
  const cp2Effective = geometry.effective?.controlPoints?.cp2;

  const startAnchor = resolveAnchorPoint(
    segment.start,
    effectiveRenderParams?.start,
    renderScaleY,
    connectorDepth,
  );
  const endAnchor = resolveAnchorPoint(
    segment.end,
    effectiveRenderParams?.end,
    renderScaleY,
    connectorDepth,
  );
  if (!startAnchor || !endAnchor) return null;

  const handles = [
    {
      id: `${segment.start.id}-out`,
      anchor: startAnchor.line,
      raw: mapHandlePoint(cp1Raw, renderScaleY, connectorDepth, rawHandleDepth),
      effective: mapHandlePoint(cp1Effective, renderScaleY, connectorDepth, effectiveHandleDepth),
      hasEffectiveGap: hasWorldPointGap(cp1Raw, cp1Effective),
      isFallback: !startHasExplicitOut,
    },
    {
      id: `${segment.end.id}-in`,
      anchor: endAnchor.line,
      raw: mapHandlePoint(cp2Raw, renderScaleY, connectorDepth, rawHandleDepth),
      effective: mapHandlePoint(cp2Effective, renderScaleY, connectorDepth, effectiveHandleDepth),
      hasEffectiveGap: hasWorldPointGap(cp2Raw, cp2Effective),
      isFallback: !endHasExplicitIn,
    },
  ].filter((handle) => handle.raw) as {
    id: string;
    anchor: [number, number, number];
    raw: HandlePoint;
    effective?: HandlePoint;
    hasEffectiveGap: boolean;
    isFallback: boolean;
  }[];

  if (handles.length === 0) return null;

  const connectorOpacity = isHighlighted ? 0.95 : 0.65;
  const gapOpacity = isHighlighted ? 0.6 : 0.35;

  return (
    <group>
      {handles.map((handle) => {
        const connectorTarget = handle.effective ?? handle.raw;
        return (
          <group key={handle.id}>
            <Line
              points={[handle.anchor, connectorTarget.line]}
              color={color}
              lineWidth={1.5}
              transparent
              opacity={connectorOpacity}
            />
            {handle.hasEffectiveGap && handle.effective && (
              <Line
                points={[handle.effective.line, handle.raw.line]}
                color={color}
                lineWidth={1.5}
                transparent
                opacity={gapOpacity}
              />
            )}
            <HandleDot
              position={handle.raw.marker}
              color={color}
              radiusPx={RAW_RADIUS_PX}
              scale={scaleValue}
              showFallbackOverlay={handle.isFallback}
              backgroundColor={backgroundColor}
            />
          </group>
        );
      })}
    </group>
  );
});

function mapHandlePoint(
  cp: WorldCP | undefined,
  scaleY: (value: number) => number,
  lineDepth: number,
  markerDepth: number,
): HandlePoint | undefined {
  if (!cp) return undefined;
  const scaledY = scaleY(cp.y);
  return {
    line: [cp.x, scaledY, lineDepth],
    marker: [cp.x, scaledY, markerDepth],
  };
}

function resolveAnchorPoint(
  frame: InstancedFrameInfo,
  params: { x: number; y: number } | undefined,
  scaleY: (value: number) => number,
  depth: number,
): HandlePoint | undefined {
  const fallbackValue = extractFrameValue(frame);
  if (fallbackValue === undefined && !params) return undefined;
  const x = params?.x ?? frame.stamp;
  const yValue = params?.y ?? fallbackValue ?? 0;
  const y = scaleY(yValue);
  const point: [number, number, number] = [x, y, depth];
  return { line: point, marker: point };
}

function extractFrameValue(frame: InstancedFrameInfo): number | undefined {
  const firstPoint = frame.points[0];
  return typeof firstPoint?.value === "number" ? (firstPoint.value as number) : undefined;
}

interface HandleDotProps {
  position: [number, number, number];
  color: string;
  radiusPx: number;
  scale: number;
  showFallbackOverlay?: boolean;
  backgroundColor: string;
}

function HandleDot({
  position,
  color,
  radiusPx,
  scale,
  showFallbackOverlay = false,
  backgroundColor,
}: HandleDotProps) {
  const radiusX = Math.max(scale * radiusPx, 0.002);
  const radiusY = Math.max(radiusPx, 0.002);
  return (
    <group position={position}>
      <mesh scale={[radiusX, radiusY, 1]}>
        <circleGeometry args={[1, 24]} />
        <meshBasicMaterial toneMapped={false} color={color} />
      </mesh>
      {showFallbackOverlay && (
        <mesh
          position={[0, 0, ROW_DEPTH_EPSILON * 0.5]}
          scale={[radiusX * 0.65, radiusY * 0.65, 1]}
        >
          <circleGeometry args={[1, 24]} />
          <meshBasicMaterial
            toneMapped={false}
            color={backgroundColor}
            transparent
            opacity={0.65}
          />
        </mesh>
      )}
    </group>
  );
}

function hasWorldPointGap(raw?: WorldCP, effective?: WorldCP, epsilon = 1e-5): boolean {
  if (!raw || !effective) return false;
  return Math.abs(raw.x - effective.x) > epsilon || Math.abs(raw.y - effective.y) > epsilon;
}
