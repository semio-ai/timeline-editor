import { memo, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Line, useCursor } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { Camera, Group, Mesh, Vector3 } from "three";
import { useMotionValueEvent, useSpring } from "motion/react";
import { Theme } from "@semio/ui";
import type { RawVector2 } from "@semio/utils";
import {
  InstancePair,
  InstancedFrameInfo,
  LayerBand,
  StandardTransitionType,
  TrackRender,
  TransitionPairing,
  VerticalAxisRange,
  WorldCP,
  HandleDragStartInput,
  HandleDragUpdateInput,
  ValueScale,
} from "../../types";
import { useDragGestures } from "../../hooks/use-drag-gestures";
import { useAnimationStore, useInvariantScale } from "../../hooks";
import { ROW_DEPTH_EPSILON } from "../../constants";
import { computeRenderScale } from "./utils/render-scale";
import { getLayerZ } from "./utils/layers";

interface HandlePoint {
  line: [number, number, number];
  marker: [number, number, number];
}

interface HandleInteractionProps {
  side: "in" | "out";
  rowId: string;
  trackId: string;
  keypointId: string;
  neighborKeypointId: string;
  controlPoint: WorldCP;
  startStamp: number;
  endStamp: number;
  startValue: number;
  endValue: number;
  attributePath?: string[];
  valueScale?: ValueScale;
  pixelRangeY: number;
  startHandleDrag: (input: HandleDragStartInput) => void;
  updateHandleDrag: (input: HandleDragUpdateInput) => void;
  commitDrag: () => void;
  cancelDrag: () => void;
}

interface BezierHandlesProps {
  segment: InstancePair;
  height: number;
  verticalBounds: { min: number; max: number };
  verticalAxisRange?: VerticalAxisRange;
  color: string;
  layer: LayerBand;
  rowId: string;
  trackId?: string;
  attributePath?: string[];
  isHighlighted?: boolean;
  appearance?: number;
  theme?: Theme.Light | Theme.Dark;
}

const RAW_RADIUS_PX = 4;
const PAIRING_FLAT_TOLERANCE_RAD = (3 * Math.PI) / 180;

const tmpAnchor = new Vector3();
const tmpMarker = new Vector3();

export const BezierHandles = memo(function BezierHandles({
  segment,
  height,
  verticalBounds,
  verticalAxisRange,
  color,
  layer,
  rowId,
  trackId,
  attributePath,
  isHighlighted = false,
  appearance = 1,
  theme = Theme.Light,
}: BezierHandlesProps) {
  const startHandleDragAction = useAnimationStore((state) => state.startHandleDrag);
  const updateHandleDragAction = useAnimationStore((state) => state.updateHandleDrag);
  const commitDragAction = useAnimationStore((state) => state.commitDrag);
  const cancelDragAction = useAnimationStore((state) => state.cancelDrag);
  const { camera, size } = useThree();

  const resolvedTrackId = useMemo(
    () =>
      trackId ?? segment.start.points[0]?.trackId ?? segment.end.points[0]?.trackId ?? undefined,
    [segment.end.points, segment.start.points, trackId],
  );

  const resolvedAttributePath = useMemo(() => {
    if (attributePath) return attributePath;
    const startAttr =
      resolvedTrackId && segment.start.points.find((p) => p.trackId === resolvedTrackId)?.attribute;
    const endAttr =
      resolvedTrackId && segment.end.points.find((p) => p.trackId === resolvedTrackId)?.attribute;
    const fallback =
      segment.start.points[0]?.attribute ?? segment.end.points[0]?.attribute ?? undefined;
    const finalAttr = startAttr ?? endAttr ?? fallback;
    return finalAttr ? [finalAttr] : undefined;
  }, [attributePath, resolvedTrackId, segment.end.points, segment.start.points]);

  const startValue = useMemo(
    () => getFrameNumericValue(segment.start, resolvedTrackId),
    [resolvedTrackId, segment.start],
  );
  const endValue = useMemo(
    () => getFrameNumericValue(segment.end, resolvedTrackId),
    [resolvedTrackId, segment.end],
  );

  const pixelRangeY = useMemo(() => {
    const visualScale = verticalAxisRange?.visualScale ?? 1;
    const span = Math.max(height * visualScale, 1);
    return span;
  }, [height, verticalAxisRange?.visualScale]);

  const resolvedValueScale = useMemo<ValueScale>(
    () => ({
      domain: [verticalBounds.min, verticalBounds.max],
      clamp: false,
    }),
    [verticalBounds.max, verticalBounds.min],
  );

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

  const startPairing = resolveHandlePairing(segment.start.transitions);
  const endPairing = resolveHandlePairing(segment.end.transitions);

  const handles = [
    {
      id: `${segment.start.id}-out`,
      side: "out" as const,
      rawWorld: cp1Raw,
      anchorId: segment.start.id,
      neighborId: segment.end.id,
      anchor: startAnchor.line,
      raw: mapHandlePoint(cp1Raw, renderScaleY, connectorDepth, rawHandleDepth),
      effective: mapHandlePoint(cp1Effective, renderScaleY, connectorDepth, effectiveHandleDepth),
      hasEffectiveGap: hasWorldPointGap(cp1Raw, cp1Effective),
      isFallback: !startHasExplicitOut,
      pairing: startPairing,
    },
    {
      id: `${segment.end.id}-in`,
      side: "in" as const,
      rawWorld: cp2Raw,
      anchorId: segment.end.id,
      neighborId: segment.start.id,
      anchor: endAnchor.line,
      raw: mapHandlePoint(cp2Raw, renderScaleY, connectorDepth, rawHandleDepth),
      effective: mapHandlePoint(cp2Effective, renderScaleY, connectorDepth, effectiveHandleDepth),
      hasEffectiveGap: hasWorldPointGap(cp2Raw, cp2Effective),
      isFallback: !endHasExplicitIn,
      pairing: endPairing,
    },
  ].filter((handle) => handle.raw && handle.rawWorld) as {
    id: string;
    side: "out" | "in";
    rawWorld: WorldCP;
    anchorId: string;
    neighborId: string;
    anchor: [number, number, number];
    raw: HandlePoint;
    effective?: HandlePoint;
    hasEffectiveGap: boolean;
    isFallback: boolean;
    pairing?: TransitionPairing;
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
        const orientation =
          handle.pairing === TransitionPairing.Paired
            ? 0
            : resolveHandleOrientation(handle.anchor, animatedRaw.marker, camera as Camera, size);
        const interaction =
          resolvedTrackId &&
          typeof startValue === "number" &&
          typeof endValue === "number" &&
          handle.rawWorld
            ? {
                side: handle.side,
                rowId,
                trackId: resolvedTrackId,
                keypointId: handle.anchorId,
                neighborKeypointId: handle.neighborId,
                controlPoint: handle.rawWorld,
                startStamp: segment.start.stamp,
                endStamp: segment.end.stamp,
                startValue,
                endValue,
                attributePath: resolvedAttributePath,
                valueScale: resolvedValueScale, // clamp disabled; provides range for deltas
                pixelRangeY,
                startHandleDrag: startHandleDragAction,
                updateHandleDrag: updateHandleDragAction,
                commitDrag: commitDragAction,
                cancelDrag: cancelDragAction,
              }
            : undefined;
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
              showFallbackOverlay={handle.isFallback}
              pairing={handle.pairing}
              orientation={orientation}
              backgroundColor={backgroundColor}
              appearance={appearance}
              interaction={interaction}
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

function getFrameNumericValue(frame: InstancedFrameInfo, trackId?: string): number | undefined {
  if (trackId) {
    const match = frame.points.find((point) => point.trackId === trackId);
    if (match && typeof match.value === "number") {
      return match.value as number;
    }
  }
  const fallback = frame.points.find((point) => typeof point.value === "number");
  return typeof fallback?.value === "number" ? (fallback.value as number) : undefined;
}

function resolveHandlePairing(
  transitions?: InstancedFrameInfo["transitions"],
): TransitionPairing | undefined {
  if (!transitions) return undefined;
  if (transitions.pairing) return transitions.pairing;
  return inferPairingFromHandles(transitions.in, transitions.out);
}

function inferPairingFromHandles(
  inHandle?: RawVector2 | StandardTransitionType,
  outHandle?: RawVector2 | StandardTransitionType,
): TransitionPairing | undefined {
  const inVector = extractVector(inHandle);
  const outVector = extractVector(outHandle);
  if (!inVector || !outVector) {
    return undefined;
  }

  const inMagnitude = Math.hypot(inVector.x, inVector.y);
  const outMagnitude = Math.hypot(outVector.x, outVector.y);
  if (inMagnitude === 0 || outMagnitude === 0) {
    return undefined;
  }

  const dot = clampToUnitInterval(
    (inVector.x * outVector.x + inVector.y * outVector.y) / (inMagnitude * outMagnitude),
  );
  const angle = Math.acos(dot);
  if (Math.abs(Math.PI - angle) <= PAIRING_FLAT_TOLERANCE_RAD) {
    return TransitionPairing.Paired;
  }
  return TransitionPairing.Free;
}

function extractVector(handle?: RawVector2 | StandardTransitionType): RawVector2 | undefined {
  if (handle && typeof handle === "object") {
    return handle;
  }
  return undefined;
}

function clampToUnitInterval(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

function resolveHandleOrientation(
  anchor: [number, number, number],
  marker: [number, number, number],
  camera: Camera,
  viewport: { width: number; height: number },
): number {
  tmpAnchor.set(anchor[0], anchor[1], anchor[2]).project(camera);
  tmpMarker.set(marker[0], marker[1], marker[2]).project(camera);

  // NDC -> pixels
  const dx = (tmpMarker.x - tmpAnchor.x) * (viewport.width / 2);
  const dy = (tmpMarker.y - tmpAnchor.y) * (viewport.height / 2);
  return Math.atan2(dy, dx);
}

interface HandleDotProps {
  position: [number, number, number];
  color: string;
  radiusPx: number;
  showFallbackOverlay?: boolean;
  pairing?: TransitionPairing;
  orientation?: number;
  backgroundColor: string;
  appearance: number;
  interaction?: HandleInteractionProps;
}

const HandleDot = memo(function HandleDot({
  position,
  color,
  radiusPx,
  showFallbackOverlay = false,
  pairing,
  orientation = 0,
  backgroundColor,
  appearance,
  interaction,
}: HandleDotProps) {
  const gl = useThree((state) => state.gl);
  const scaleRef = useRef<Group>(null);
  const markerRef = useRef<Mesh>(null);
  const overlayRef = useRef<Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragDidMoveRef = useRef(false);
  const dragSpring = useSpring(0, { stiffness: 280, damping: 24, mass: 1 });
  const [dragWeight, setDragWeight] = useState(0);
  useMotionValueEvent(dragSpring, "change", setDragWeight);
  useCursor(Boolean(interaction) && (hovered || dragging), "pointer", "auto", gl.domElement);

  const handleDragHandlers = useDragGestures({
    disabled: !interaction,
    dragOptions: {
      preventScroll: true,
      filterTaps: true,
      pointer: { touch: false },
    },
    pixelRangeY: interaction?.pixelRangeY ?? 1,
    onDragStart: (positionX) => {
      if (!interaction) return;
      dragDidMoveRef.current = false;
      setDragging(true);
      setDragWeight(1);
      dragSpring.set(1);
      interaction.startHandleDrag({
        origin: { x: positionX, y: interaction.controlPoint.y },
        side: interaction.side,
        rowId: interaction.rowId,
        trackId: interaction.trackId,
        keypointId: interaction.keypointId,
        neighborKeypointId: interaction.neighborKeypointId,
        attributePath: interaction.attributePath,
        valueScale: interaction.valueScale,
        controlPoint: interaction.controlPoint,
        startStamp: interaction.startStamp,
        endStamp: interaction.endStamp,
        startValue: interaction.startValue,
        endValue: interaction.endValue,
      });
    },
    onDrag2D: ({ x, normalizedValueDelta, alt, shift, meta }) => {
      if (!interaction) return;
      dragDidMoveRef.current = true;
      interaction.updateHandleDrag({
        pointer: { x, y: 0 },
        normalizedValueDelta,
        modifiers: { alt, shift, meta },
      });
    },
    onDragEnd: () => {
      if (!interaction) return;
      if (dragDidMoveRef.current) {
        interaction.commitDrag();
      } else {
        interaction.cancelDrag();
      }
      dragDidMoveRef.current = false;
      setDragging(false);
      setDragWeight(0);
      dragSpring.set(0);
    },
  });

  const invariantScale = useInvariantScale();
  const dragScale = 1 + dragWeight * 0.3;
  const hoverScale = hovered ? 1.1 : 1;
  const isPaired = pairing === TransitionPairing.Paired;
  const geometrySegments = isPaired ? 24 : 4;
  const typeScaling = isPaired ? 1 : 1.2;

  useMotionValueEvent(invariantScale, "change", (iscale) => {
    // calculate the new mesh scales and apply it to the meshes
    const newScaleX = Math.max(iscale * radiusPx * hoverScale * dragScale);
    const newScaleY = Math.max(radiusPx * hoverScale * dragScale);

    if (scaleRef.current) {
      scaleRef.current.scale.set(newScaleX, newScaleY, 1);
    }
    // if (overlayRef.current) {
    //   overlayRef.current.scale.set(newScaleX * 0.65, newScaleY * 0.65, 1);
    // }
  });

  useLayoutEffect(() => {
    const iscale = invariantScale.get();
    const newScaleX = Math.max(iscale * radiusPx * hoverScale * dragScale * typeScaling);
    const newScaleY = Math.max(radiusPx * hoverScale * dragScale * typeScaling);

    if (scaleRef.current) {
      scaleRef.current.scale.set(newScaleX, newScaleY, 1);
    }
    // if (overlayRef.current) {
    //   overlayRef.current.scale.set(newScaleX * 0.65, newScaleY * 0.65, 1);
    // }
  }, [invariantScale, radiusPx, hoverScale, dragScale, typeScaling]);

  const clamped = Math.max(0, Math.min(1, appearance));

  const baseRadiusX = useMemo<number>(
    () => Math.max(invariantScale.get() * radiusPx * hoverScale * dragScale * typeScaling, 0.002),
    [invariantScale, radiusPx, hoverScale, dragScale, typeScaling],
  );
  const baseRadiusY = useMemo<number>(
    () => Math.max(radiusPx * hoverScale * dragScale * typeScaling, 0.002),
    [radiusPx, hoverScale, dragScale, typeScaling],
  );

  const rotation: [number, number, number] = [0, 0, isPaired ? 0 : orientation];

  return (
    <group
      position={position}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerMove={(e) => {
        e.stopPropagation();
        if (!hovered) setHovered(true);
        handleDragHandlers.onPointerMove?.(e);
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        setHovered(false);
      }}
      onPointerDown={(e) => {
        e.stopPropagation();
        setDragging(true);
        dragSpring.set(1);
        handleDragHandlers.onPointerDown?.(e);
      }}
      onPointerUp={(e) => {
        e.stopPropagation();
        setDragging(false);
        dragSpring.set(0);
        handleDragHandlers.onPointerUp?.(e);
      }}
      onPointerCancel={(e) => {
        e.stopPropagation();
        handleDragHandlers.onPointerCancel?.(e);
        if (interaction) {
          interaction.cancelDrag();
        }
        dragDidMoveRef.current = false;
        setDragging(false);
        dragSpring.set(0);
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <group ref={scaleRef as any} scale={[baseRadiusX, baseRadiusY, 1]}>
        <mesh ref={markerRef as any} rotation={rotation}>
          <circleGeometry args={[1, geometrySegments]} />
          <meshBasicMaterial toneMapped={false} color={color} transparent opacity={clamped} />
        </mesh>
        {showFallbackOverlay && (
          <mesh
            ref={overlayRef as any}
            position={[0, 0, ROW_DEPTH_EPSILON * 0.5]}
            rotation={rotation}
            scale={[0.65, 0.65, 1]}
          >
            <circleGeometry args={[1, geometrySegments]} />
            <meshBasicMaterial
              toneMapped={false}
              color={backgroundColor}
              transparent
              opacity={0.65 * clamped}
            />
          </mesh>
        )}
      </group>
    </group>
  );
});

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
