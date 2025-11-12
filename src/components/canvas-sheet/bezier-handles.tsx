import { memo, useState } from "react";
import { Line } from "@react-three/drei";
import { useMotionValueEvent } from "motion/react";
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
}: BezierHandlesProps) {
  const invariantScale = useInvariantScale();
  const [scaleValue, setScaleValue] = useState(() => invariantScale.get());
  useMotionValueEvent(invariantScale, "change", setScaleValue);

  const geometry = segment.geometry;
  if (!geometry || segment.buffer) {
    return null;
  }

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
      raw: mapHandlePoint(
        geometry.raw?.controlPoints?.cp1,
        renderScaleY,
        connectorDepth,
        rawHandleDepth,
      ),
      effective: mapHandlePoint(
        geometry.effective?.controlPoints?.cp1,
        renderScaleY,
        connectorDepth,
        effectiveHandleDepth,
      ),
    },
    {
      id: `${segment.end.id}-in`,
      anchor: endAnchor.line,
      raw: mapHandlePoint(
        geometry.raw?.controlPoints?.cp2,
        renderScaleY,
        connectorDepth,
        rawHandleDepth,
      ),
      effective: mapHandlePoint(
        geometry.effective?.controlPoints?.cp2,
        renderScaleY,
        connectorDepth,
        effectiveHandleDepth,
      ),
    },
  ].filter((handle) => handle.raw) as {
    id: string;
    anchor: [number, number, number];
    raw: HandlePoint;
    effective?: HandlePoint;
  }[];

  if (handles.length === 0) return null;

  const effectiveOpacity = isHighlighted ? 1 : 0.55;
  const rawOpacity = isHighlighted ? 0.5 : 0.35;

  return (
    <group>
      {handles.map((handle) => {
        return (
          <group key={handle.id}>
            {/* A section that covers the whole length */}
            <Line
              points={[handle.anchor, handle.raw.line]}
              color={color}
              lineWidth={1.5}
              transparent
              opacity={handle.effective ? rawOpacity : effectiveOpacity}
            />
            {handle.effective && (
              <Line
                points={[handle.anchor, handle.effective.line]}
                color={color}
                lineWidth={1.5}
                transparent
                opacity={effectiveOpacity}
              />
            )}
            <HandleDot
              position={handle.raw.line}
              color={color}
              radiusPx={RAW_RADIUS_PX}
              scale={scaleValue}
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
}

function HandleDot({ position, color, radiusPx, scale }: HandleDotProps) {
  // const radius = Math.max(radiusPx * scale, 0.002);
  return (
    <group position={position}>
      <mesh scale={[scale * radiusPx, radiusPx, 1]}>
        <circleGeometry args={[1, 24]} />
        <meshBasicMaterial toneMapped={false} color={color} />
      </mesh>
    </group>
  );
}
