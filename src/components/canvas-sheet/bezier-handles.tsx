import { memo, useEffect, useState } from "react";
import { Line } from "@react-three/drei";
import { useMotionValueEvent, useSpring } from "motion/react";
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
  const appearanceSpring = useSpring(0, { stiffness: 700, damping: 40 });
  const [appearanceProgress, setAppearanceProgress] = useState(0);
  useEffect(() => {
    appearanceSpring.set(1);
    return () => {
      appearanceSpring.set(0);
    };
  }, [appearanceSpring]);
  useMotionValueEvent(appearanceSpring, "change", setAppearanceProgress);
  const appearance = Math.max(0, Math.min(1, appearanceProgress));

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

  const connectorOpacityBase = isHighlighted ? 0.95 : 0.65;
  const connectorOpacity = connectorOpacityBase * appearance;
  const gapOpacityBase = isHighlighted ? 0.6 : 0.35;
  const gapOpacity = gapOpacityBase * Math.max(0, Math.min(1, (appearance - 0.2) / 0.8));

  return (
    <group>
      {handles.map((handle) => {
        const animatedRaw = animateHandlePoint(handle.anchor, handle.raw, appearance);
        const animatedEffective = handle.effective
          ? animateHandlePoint(handle.anchor, handle.effective, appearance)
          : undefined;
        const connectorTarget = animatedEffective ?? animatedRaw;
        return (
          <group key={handle.id}>
            <Line
              points={[handle.anchor, connectorTarget.line]}
              color={color}
              lineWidth={1.5}
              transparent
              opacity={connectorOpacity}
            />
            {handle.hasEffectiveGap && animatedEffective && (
              <Line
                points={[animatedEffective.line, animatedRaw.line]}
                color={color}
                lineWidth={1.5}
                transparent
                opacity={gapOpacity}
              />
            )}
            <HandleDot
              position={animatedRaw.marker}
              color={color}
              radiusPx={RAW_RADIUS_PX}
              scale={scaleValue}
              showFallbackOverlay={handle.isFallback}
              backgroundColor={backgroundColor}
              appearance={appearance}
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
  appearance: number;
}

function HandleDot({
  position,
  color,
  radiusPx,
  scale,
  showFallbackOverlay = false,
  backgroundColor,
  appearance,
}: HandleDotProps) {
  const clamped = Math.max(0, Math.min(1, appearance));
  const baseRadiusX = Math.max(scale * radiusPx, 0.002);
  const baseRadiusY = Math.max(radiusPx, 0.002);
  const radiusX = baseRadiusX * clamped;
  const radiusY = baseRadiusY * clamped;
  const overlayRadiusX = radiusX * 0.65;
  const overlayRadiusY = radiusY * 0.65;
  return (
    <group position={position}>
      <mesh scale={[radiusX, radiusY, 1]}>
        <circleGeometry args={[1, 24]} />
        <meshBasicMaterial toneMapped={false} color={color} transparent opacity={clamped} />
      </mesh>
      {showFallbackOverlay && (
        <mesh
          position={[0, 0, ROW_DEPTH_EPSILON * 0.5]}
          scale={[overlayRadiusX, overlayRadiusY, 1]}
        >
          <circleGeometry args={[1, 24]} />
          <meshBasicMaterial
            toneMapped={false}
            color={backgroundColor}
            transparent
            opacity={0.65 * clamped}
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

function animateHandlePoint(
  anchor: [number, number, number],
  point: HandlePoint,
  t: number,
): HandlePoint {
  return {
    line: lerpPoint(anchor, point.line, t),
    marker: lerpPoint(anchor, point.marker, t),
  };
}

function lerpPoint(
  anchor: [number, number, number],
  target: [number, number, number],
  t: number,
): [number, number, number] {
  return [
    anchor[0] + (target[0] - anchor[0]) * t,
    anchor[1] + (target[1] - anchor[1]) * t,
    anchor[2] + (target[2] - anchor[2]) * t,
  ];
}
