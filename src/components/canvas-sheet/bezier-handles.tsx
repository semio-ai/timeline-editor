import { memo, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Line, useCursor } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { Camera, Group, Mesh, OrthographicCamera, Vector3 } from "three";
import { useMotionValueEvent, useSpring } from "motion/react";
import { Theme } from "@semio/ui";
import type { RawVector2 } from "@semio/utils";
import {
  InstancePair,
  InstancedFrameInfo,
  LayerBand,
  StandardTransitionType,
  TrackRender,
  TransitionHandleKind,
  TransitionPairing,
  VerticalAxisRange,
  WorldCP,
  HandleDragStartInput,
  HandleDragUpdateInput,
  ValueScale,
} from "../../types";
import { clampHandleAgainstOwnKeypointX } from "../../functions/solve-handle-transition";
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
  pairedDelta?: RawVector2;
  viewScaleX?: number;
  viewScaleY?: number;
  startStamp: number;
  endStamp: number;
  startValue: number;
  endValue: number;
  basePairing?: TransitionPairing;
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
  isHighlighted?: boolean;
  appearance?: number;
  theme?: Theme.Light | Theme.Dark;
  handleLookup?: Map<string, { in?: RawVector2; out?: RawVector2 }>;
}

const RAW_RADIUS_PX = 4;
const PAIRING_FLAT_TOLERANCE_RAD = (3 * Math.PI) / 180;

const tmpAnchor = new Vector3();
const tmpMarker = new Vector3();

const computeVerticalRange = (valueScale?: ValueScale): number => {
  if (!valueScale) return 1;
  const range = valueScale.domain[1] - valueScale.domain[0];
  return Number.isFinite(range) && range !== 0 ? range : 1;
};

const applyPrecision = (value: number, precision?: number): number => {
  if (precision === undefined) return value;
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
};

const toViewVector = (delta: RawVector2, scaleX: number, scaleY: number): RawVector2 => ({
  x: delta.x * scaleX,
  y: delta.y * scaleY,
});

const getViewLength = (delta: RawVector2, scaleX: number, scaleY: number): number => {
  const view = toViewVector(delta, scaleX, scaleY);
  return Math.hypot(view.x, view.y);
};

const withinFlatTolerance = (a: RawVector2, b: RawVector2): boolean => {
  const aLen = Math.hypot(a.x, a.y);
  const bLen = Math.hypot(b.x, b.y);
  if (aLen === 0 || bLen === 0) {
    return false;
  }
  const dot = (a.x * b.x + a.y * b.y) / (aLen * bLen);
  const clamped = Math.max(-1, Math.min(1, dot));
  const angle = Math.acos(clamped);
  return Math.abs(Math.PI - angle) <= PAIRING_FLAT_TOLERANCE_RAD;
};

const debugHandles = (label: string, payload: Record<string, unknown>): void => {
  if (
    typeof globalThis !== "undefined" &&
    (globalThis as { __DEBUG_BEZIER_HANDLES__?: boolean }).__DEBUG_BEZIER_HANDLES__
  ) {
    console.log(`[bezier-handles] ${label}`, payload);
  }
};

export const BezierHandles = memo(function BezierHandles({
  segment,
  height,
  verticalBounds,
  verticalAxisRange,
  color,
  layer,
  rowId,
  trackId,
  isHighlighted = false,
  appearance = 1,
  theme = Theme.Light,
  handleLookup,
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

  const backgroundColor = theme === Theme.Dark ? "#050505" : "#F7F7F7";

  const { renderScaleY, splineRange } = computeRenderScale({
    trackRender: TrackRender.Spline,
    height,
    verticalBounds,
    verticalAxisRange,
  });
  const viewScaleX = (() => {
    const ortho = camera as OrthographicCamera;
    const span = ortho.right - ortho.left;
    if (!Number.isFinite(span) || span === 0 || size.width === 0) {
      return 1;
    }
    return size.width / span;
  })();
  const viewScaleY = useMemo(() => {
    const domainSpan = verticalBounds.max - verticalBounds.min;
    if (!Number.isFinite(domainSpan) || domainSpan === 0) {
      return 1;
    }
    return splineRange.span / domainSpan;
  }, [splineRange.span, verticalBounds.max, verticalBounds.min]);

  const zBase = getLayerZ(layer);
  const connectorDepth = zBase - ROW_DEPTH_EPSILON * 0.05;
  const rawHandleDepth = zBase - ROW_DEPTH_EPSILON * 0.1;
  const effectiveHandleDepth = zBase - ROW_DEPTH_EPSILON * 0.08;

  const memoizedHandles = useMemo(() => {
    if (!geometry || segment.buffer) {
      return { handles: [], connectorOpacity: 0, gapOpacity: 0 };
    }
    const rawRenderParams = geometry.raw?.renderParams?.[TrackRender.Spline];
    const effectiveRenderParams =
      geometry.effective?.renderParams?.[TrackRender.Spline] ?? rawRenderParams;

    const startOutHandle = geometry.raw?.handles?.startOut;
    const endInHandle = geometry.raw?.handles?.endIn;
    const cp1Raw = startOutHandle?.world ?? geometry.raw?.controlPoints?.cp1;
    const cp1Effective =
      geometry.effective?.handles?.startOut?.world ?? geometry.effective?.controlPoints?.cp1;
    const cp2Raw = endInHandle?.world ?? geometry.raw?.controlPoints?.cp2;
    const cp2Effective =
      geometry.effective?.handles?.endIn?.world ?? geometry.effective?.controlPoints?.cp2;
    const startOutKind = startOutHandle?.kind;
    const endInKind = endInHandle?.kind;

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
    if (!startAnchor || !endAnchor) {
      return { handles: [], connectorOpacity: 0, gapOpacity: 0 };
    }

    const startPairing = resolveHandlePairing(segment.start.transitions);
    const endPairing = resolveHandlePairing(segment.end.transitions);
    const startPoint = getFramePoint(segment.start, resolvedTrackId);
    const endPoint = getFramePoint(segment.end, resolvedTrackId);
    const startAnchorId = startPoint?.id ?? segment.start.id;
    const endAnchorId = endPoint?.id ?? segment.end.id;
    const startPairedDelta = handleLookup?.get(startAnchorId)?.in;
    const endPairedDelta = handleLookup?.get(endAnchorId)?.out;
    const built = [
      {
        id: `${segment.start.id}-out`,
        side: "out" as const,
        rawWorld: cp1Raw,
        anchorId: startAnchorId,
        neighborId: endAnchorId,
        pairedDelta: startPairedDelta,
        anchor: startAnchor.line,
        raw: mapHandlePoint(cp1Raw, renderScaleY, connectorDepth, rawHandleDepth),
        effective: mapHandlePoint(cp1Effective, renderScaleY, connectorDepth, effectiveHandleDepth),
        hasEffectiveGap: hasWorldPointGap(cp1Raw, cp1Effective),
        isFallback: startOutKind !== TransitionHandleKind.Explicit,
        pairing: startPairing,
        interaction:
          resolvedTrackId &&
          typeof startValue === "number" &&
          typeof endValue === "number" &&
          cp1Raw
            ? {
                side: "out",
                rowId,
                trackId: resolvedTrackId,
                keypointId: startAnchorId,
                neighborKeypointId: endAnchorId,
                controlPoint: cp1Raw,
                pairedDelta: startPairedDelta,
                viewScaleX,
                viewScaleY,
                startStamp: segment.start.stamp,
                endStamp: segment.end.stamp,
                startValue,
                endValue,
                basePairing: startPairing,
                valueScale: resolvedValueScale,
                pixelRangeY,
                startHandleDrag: startHandleDragAction,
                updateHandleDrag: updateHandleDragAction,
                commitDrag: commitDragAction,
                cancelDrag: cancelDragAction,
              }
            : undefined,
      },
      {
        id: `${segment.end.id}-in`,
        side: "in" as const,
        rawWorld: cp2Raw,
        anchorId: endAnchorId,
        neighborId: startAnchorId,
        pairedDelta: endPairedDelta,
        anchor: endAnchor.line,
        raw: mapHandlePoint(cp2Raw, renderScaleY, connectorDepth, rawHandleDepth),
        effective: mapHandlePoint(cp2Effective, renderScaleY, connectorDepth, effectiveHandleDepth),
        hasEffectiveGap: hasWorldPointGap(cp2Raw, cp2Effective),
        isFallback: endInKind !== TransitionHandleKind.Explicit,
        pairing: endPairing,
        interaction:
          resolvedTrackId &&
          typeof startValue === "number" &&
          typeof endValue === "number" &&
          cp2Raw
            ? {
                side: "in",
                rowId,
                trackId: resolvedTrackId,
                keypointId: endAnchorId,
                neighborKeypointId: startAnchorId,
                controlPoint: cp2Raw,
                pairedDelta: endPairedDelta,
                viewScaleX,
                viewScaleY,
                startStamp: segment.start.stamp,
                endStamp: segment.end.stamp,
                startValue,
                endValue,
                basePairing: endPairing,
                valueScale: resolvedValueScale,
                pixelRangeY,
                startHandleDrag: startHandleDragAction,
                updateHandleDrag: updateHandleDragAction,
                commitDrag: commitDragAction,
                cancelDrag: cancelDragAction,
              }
            : undefined,
      },
    ].filter((handle) => handle.raw && handle.rawWorld) as {
      id: string;
      side: "out" | "in";
      rawWorld: WorldCP;
      anchorId: string;
      neighborId: string;
      pairedDelta?: RawVector2;
      anchor: [number, number, number];
      raw: HandlePoint;
      effective?: HandlePoint;
      hasEffectiveGap: boolean;
      isFallback: boolean;
      pairing?: TransitionPairing;
      interaction?: HandleInteractionProps;
    }[];

    const connectorOpacityBase = isHighlighted ? 0.95 : 0.65;
    const connectorOpacity = connectorOpacityBase * appearance;
    const gapOpacityBase = isHighlighted ? 0.6 : 0.35;
    const gapOpacity = gapOpacityBase * Math.max(0, Math.min(1, (appearance - 0.2) / 0.8));

    return { handles: built, connectorOpacity, gapOpacity };
  }, [
    rowId,
    appearance,
    connectorDepth,
    effectiveHandleDepth,
    geometry,
    isHighlighted,
    segment.buffer,
    renderScaleY,
    segment.end,
    segment.start,
    rawHandleDepth,
    resolvedTrackId,
    resolvedValueScale,
    pixelRangeY,
    startHandleDragAction,
    updateHandleDragAction,
    commitDragAction,
    cancelDragAction,
    startValue,
    endValue,
    handleLookup,
    viewScaleX,
    viewScaleY,
  ]);

  const handles = memoizedHandles.handles;
  const connectorOpacity = memoizedHandles.connectorOpacity;
  const gapOpacity = memoizedHandles.gapOpacity;

  if (!geometry || segment.buffer || handles.length === 0) return null;

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
                pairedDelta: handle.pairedDelta,
                viewScaleX,
                viewScaleY,
                startStamp: segment.start.stamp,
                endStamp: segment.end.stamp,
                startValue,
                endValue,
                basePairing: handle.pairing,
                valueScale: resolvedValueScale, // clamp disabled; provides range for deltas
                pixelRangeY,
                startHandleDrag: startHandleDragAction,
                updateHandleDrag: updateHandleDragAction,
                commitDrag: commitDragAction,
                cancelDrag: cancelDragAction,
              }
            : undefined;
        return (
          <HandleGroup
            key={handle.id}
            handle={handle}
            animatedRaw={animatedRaw}
            animatedEffective={animatedEffective}
            connectorTarget={connectorTarget}
            orientation={orientation}
            connectorOpacity={connectorOpacity}
            gapOpacity={gapOpacity}
            color={color}
            backgroundColor={backgroundColor}
            appearance={appearance}
            interaction={interaction}
          />
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

function getFramePoint(frame: InstancedFrameInfo, trackId?: string) {
  if (trackId) {
    const match = frame.points.find((point) => point.trackId === trackId);
    if (match) {
      return match;
    }
  }
  return frame.points[0];
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

const HandleGroup = memo(function HandleGroup({
  handle,
  animatedRaw,
  animatedEffective,
  connectorTarget,
  orientation,
  connectorOpacity,
  gapOpacity,
  color,
  backgroundColor,
  appearance,
  interaction,
}: {
  handle: {
    id: string;
    anchor: [number, number, number];
    hasEffectiveGap: boolean;
    pairing?: TransitionPairing;
    isFallback: boolean;
  };
  animatedRaw: HandlePoint;
  animatedEffective?: HandlePoint;
  connectorTarget: HandlePoint;
  orientation: number;
  connectorOpacity: number;
  gapOpacity: number;
  color: string;
  backgroundColor: string;
  appearance: number;
  interaction?: HandleInteractionProps;
}) {
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
});

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
  const { gl, camera, size } = useThree((state) => ({
    gl: state.gl,
    camera: state.camera,
    size: state.size,
  }));
  const scaleRef = useRef<Group>(null);
  const markerRef = useRef<Mesh>(null);
  const overlayRef = useRef<Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragDidMoveRef = useRef(false);
  const dragBaseRef = useRef<{
    controlPoint: WorldCP;
    anchorStamp: number;
    anchorValue: number;
  } | null>(null);
  const dragPairingRef = useRef<TransitionPairing | undefined | null>(null);
  const pairingBaselineRef = useRef<{
    pairedDelta?: RawVector2;
    pairedLengthView?: number;
  } | null>(null);
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
      const viewScaleX = (() => {
        const ortho = camera as OrthographicCamera;
        const span = ortho.right - ortho.left;
        if (!Number.isFinite(span) || span === 0 || size.width === 0) {
          return interaction.viewScaleX ?? 1;
        }
        return size.width / span;
      })();
      const viewScaleY = interaction.viewScaleY ?? 1;
      pairingBaselineRef.current = interaction.pairedDelta
        ? {
            pairedDelta: interaction.pairedDelta,
            pairedLengthView: getViewLength(interaction.pairedDelta, viewScaleX, viewScaleY),
          }
        : null;
      dragPairingRef.current = interaction.basePairing;
      const dragBase = {
        controlPoint: {
          x: interaction.controlPoint.x,
          y: interaction.controlPoint.y,
        },
        anchorStamp: interaction.side === "out" ? interaction.startStamp : interaction.endStamp,
        anchorValue: interaction.side === "out" ? interaction.startValue : interaction.endValue,
      };
      dragBaseRef.current = dragBase;
      debugHandles("drag-start", {
        side: interaction.side,
        viewScaleX,
        viewScaleY,
        controlPoint: interaction.controlPoint,
        anchorStamp: dragBase.anchorStamp,
        anchorValue: dragBase.anchorValue,
        pairedDelta: interaction.pairedDelta,
        pairedLengthView: pairingBaselineRef.current?.pairedLengthView,
      });
      interaction.startHandleDrag({
        origin: { x: positionX, y: interaction.controlPoint.y },
        side: interaction.side,
        rowId: interaction.rowId,
        trackId: interaction.trackId,
        keypointId: interaction.keypointId,
        neighborKeypointId: interaction.neighborKeypointId,
        valueScale: interaction.valueScale,
        controlPoint: interaction.controlPoint,
        startStamp: interaction.startStamp,
        endStamp: interaction.endStamp,
        startValue: interaction.startValue,
        endValue: interaction.endValue,
        pairing: interaction.basePairing,
      });
    },
    onDrag2D: ({ x, normalizedValueDelta, alt, shift, meta }) => {
      if (!interaction) return;
      dragDidMoveRef.current = true;
      const pointerX = typeof x === "number" ? x : interaction.controlPoint.x;
      const range = computeVerticalRange(interaction.valueScale);
      const deltaY = (normalizedValueDelta ?? 0) * range;
      const dragBase = dragBaseRef.current;
      const baseControlPoint = dragBase?.controlPoint ?? interaction.controlPoint;
      const anchorStamp =
        dragBase?.anchorStamp ??
        (interaction.side === "out" ? interaction.startStamp : interaction.endStamp);
      const anchorValue =
        dragBase?.anchorValue ??
        (interaction.side === "out" ? interaction.startValue : interaction.endValue);
      const nextCpWorld = {
        x: pointerX,
        y: baseControlPoint.y + deltaY,
      };
      const clamped = clampHandleAgainstOwnKeypointX({
        anchor: interaction.side === "out" ? "startOut" : "endIn",
        cpWorld: nextCpWorld,
        startX: interaction.startStamp,
        endX: interaction.endStamp,
      });
      const nextY = applyPrecision(clamped.y, interaction.valueScale?.precision);
      const draggedDelta = {
        x: clamped.x - anchorStamp,
        y: nextY - anchorValue,
      };

      const viewScaleX = (() => {
        const ortho = camera as OrthographicCamera;
        const span = ortho.right - ortho.left;
        if (!Number.isFinite(span) || span === 0 || size.width === 0) {
          return interaction.viewScaleX ?? 1;
        }
        return size.width / span;
      })();
      const viewScaleY = interaction.viewScaleY ?? 1;
      const draggedView = toViewVector(draggedDelta, viewScaleX, viewScaleY);
      const draggedViewLen = Math.hypot(draggedView.x, draggedView.y);
      const baseline = pairingBaselineRef.current;
      const pairedBaselineView = baseline?.pairedDelta
        ? toViewVector(baseline.pairedDelta, viewScaleX, viewScaleY)
        : undefined;
      const withinSnapTolerance =
        pairedBaselineView !== undefined
          ? withinFlatTolerance(draggedView, pairedBaselineView)
          : false;

      const basePairing = dragPairingRef.current ?? interaction.basePairing;
      let pairingIntent = basePairing;
      if (shift) {
        pairingIntent = TransitionPairing.Paired;
      } else if (basePairing === TransitionPairing.Paired && alt) {
        pairingIntent = TransitionPairing.Free;
      } else if (
        (basePairing === TransitionPairing.Free || basePairing === undefined) &&
        withinSnapTolerance &&
        !alt
      ) {
        pairingIntent = TransitionPairing.Paired;
      }

      const pairedSide = interaction.side === "out" ? "in" : "out";
      let pairedDelta: RawVector2 | undefined;
      if (
        pairingIntent === TransitionPairing.Paired &&
        baseline?.pairedLengthView !== undefined &&
        draggedViewLen > 0
      ) {
        const unitX = draggedView.x / draggedViewLen;
        const unitY = draggedView.y / draggedViewLen;
        const useDraggedLength = shift && !alt;
        const targetLength = useDraggedLength ? draggedViewLen : baseline.pairedLengthView;
        const pairedView = {
          x: -unitX * targetLength,
          y: -unitY * targetLength,
        };
        pairedDelta = {
          x: pairedView.x / viewScaleX,
          y: pairedView.y / viewScaleY,
        };
      }

      const handleDeltas = {
        ...(interaction.side === "out" ? { out: draggedDelta } : { in: draggedDelta }),
        ...(pairedDelta ? { [pairedSide]: pairedDelta } : {}),
        pairing: pairingIntent,
        withinSnapTolerance,
      };

      interaction.updateHandleDrag({
        pointer: { x: pointerX, y: 0 },
        normalizedValueDelta,
        handleDeltas,
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
      debugHandles("drag-end", {
        side: interaction.side,
        moved: dragDidMoveRef.current,
      });
      dragDidMoveRef.current = false;
      dragBaseRef.current = null;
      dragPairingRef.current = null;
      pairingBaselineRef.current = null;
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
    const newScaleX = Math.max(iscale * radiusPx * hoverScale * dragScale * typeScaling);
    const newScaleY = Math.max(radiusPx * hoverScale * dragScale * typeScaling);

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
        dragBaseRef.current = null;
        dragPairingRef.current = null;
        pairingBaselineRef.current = null;
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
