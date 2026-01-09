import { memo, useMemo, useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { useThree } from "@react-three/fiber";
import { Line, useCursor } from "@react-three/drei";
import { useMotionValue, useMotionValueEvent } from "motion/react";
import * as THREE from "three";
import { Theme } from "@semio/ui";
import type { MotionValue } from "motion";
import {
  TrackRender,
  SourceRow,
  LayerBand,
  VerticalAxisRange,
  RenderSegment,
  RenderSampleCache,
} from "../../types";
import { computeOklabMix, materializeSegmentSample } from "../../functions";
import { useAnimationStore } from "../../hooks";
import { DEFAULT_COLOR, ROW_DEPTH_EPSILON } from "../../constants";
import { computeRenderScale } from "./utils/render-scale";
import { getLayerZ } from "./utils/layers";

const resolveSample = (segment: RenderSegment, render: TrackRender) => {
  if (render === TrackRender.Preview) {
    return segment.samples[TrackRender.Preview] ?? segment.samples[TrackRender.Spline];
  }
  if (render === TrackRender.Spline) {
    return segment.samples[TrackRender.Spline] ?? segment.samples[TrackRender.Preview];
  }
  return segment.samples[render];
};

interface LineRef {
  geometry: {
    setPositions: (positions: Float32Array) => void;
  };
}

const mapSampleToRowPoints = (
  sample: { points: Float32Array; stride: 2 | 3 },
  xTransform: ((stamp: number) => number) | undefined,
  renderScaleY: (value: number) => number,
): Float32Array => {
  const raw = sample.points;
  const stride = sample.stride;
  const count = Math.floor(raw.length / stride);
  const mapped = new Float32Array(count * 2);
  for (let i = 0; i < count; i += 1) {
    const offset = i * stride;
    const x = raw[offset];
    mapped[i * 2] = typeof xTransform === "function" ? xTransform(x) : x;
    mapped[i * 2 + 1] = renderScaleY(raw[offset + 1]);
  }
  return mapped;
};

export interface TransitionSegmentProps {
  segment: RenderSegment;
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
  renderMorphProgress?: MotionValue<number>;
  renderSampleCache?: RenderSampleCache;
  xTransform?: (stamp: number) => number;
}

/**
 * TransitionSegment renders polyline samples for timeline segments.
 * Samples are mapped into row space based on the active render mode.
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
  renderMorphProgress,
  renderSampleCache,
  xTransform,
}: TransitionSegmentProps) {
  const isEmpty = Boolean(segment.buffer);

  const sample = resolveSample(segment, trackRender);
  const materializedSample = useMemo(
    () => (sample ? materializeSegmentSample(sample, renderSampleCache) : null),
    [sample, renderSampleCache],
  );

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

  const currentPoints2D = useMemo(() => {
    if (!materializedSample) return null;
    if (materializedSample.points.length === 0) return null;
    return mapSampleToRowPoints(materializedSample, xTransform, renderScaleY);
  }, [materializedSample, renderScaleY, xTransform]);

  const lineWidth = useMemo(() => {
    if (trackRender === TrackRender.Key) return 2.5;
    return 2;
  }, [trackRender]);

  const bufferColor = useMemo(() => {
    if (!isEmpty) return color;
    return computeOklabMix(color, theme === Theme.Dark ? "#202020" : "#EFEFEF", 0.4);
  }, [isEmpty, color, theme]);

  const z = getLayerZ(layer);
  const fillDepth = z - ROW_DEPTH_EPSILON * 0.4;
  const lineDepth = z - ROW_DEPTH_EPSILON * 0.2;

  const lineZ = isEmpty ? fillDepth : lineDepth;
  const fallbackMorphProgress = useMotionValue(1);
  const morphProgress = renderMorphProgress ?? fallbackMorphProgress;
  const morphBufferRef = useRef<Float32Array | null>(null);
  const morphStateRef = useRef<{ from: Float32Array; to: Float32Array } | null>(null);
  const morphingRef = useRef(false);
  const prevPoints2DRef = useRef<Float32Array | null>(null);
  const prevRenderRef = useRef(trackRender);
  const lineRef = useRef<LineRef | null>(null);
  const hitLineRef = useRef<LineRef | null>(null);
  const linePositionsRef = useRef<Float32Array | null>(null);
  const fillGeometryRef = useRef<THREE.BufferGeometry | null>(null);
  const fillPositionsRef = useRef<Float32Array | null>(null);

  const linePointsWithDepth = useMemo(() => {
    if (!currentPoints2D) return [];
    const count = currentPoints2D.length / 2;
    const resolved = new Array<[number, number, number]>(count);
    for (let i = 0; i < count; i += 1) {
      const offset = i * 2;
      resolved[i] = [currentPoints2D[offset], currentPoints2D[offset + 1], lineZ];
    }
    return resolved;
  }, [currentPoints2D, lineZ]);

  const fillGeometry = useMemo<THREE.BufferGeometry | undefined>(() => {
    if (
      !currentPoints2D ||
      isEmpty ||
      (trackRender !== TrackRender.Preview && trackRender !== TrackRender.Transition)
    ) {
      return undefined;
    }

    const count = currentPoints2D.length / 2;
    if (count < 2) return undefined;

    const baseline = -height * 0.4;
    const baselineExtension = height * 0.1;
    const effectiveBaseline = baseline - Math.abs(baselineExtension);

    const vertices = new Float32Array(count * 2 * 3);
    const indices: number[] = [];

    for (let i = 0; i < count; i += 1) {
      const topIndex = i * 2;
      const bottomIndex = topIndex + 1;
      const pointOffset = i * 2;
      const pointX = currentPoints2D[pointOffset];
      const pointY = currentPoints2D[pointOffset + 1];
      const baseOffset = topIndex * 3;
      const bottomOffset = bottomIndex * 3;

      vertices[baseOffset] = pointX;
      vertices[baseOffset + 1] = pointY;
      vertices[baseOffset + 2] = fillDepth;

      vertices[bottomOffset] = pointX;
      vertices[bottomOffset + 1] = effectiveBaseline;
      vertices[bottomOffset + 2] = fillDepth;
    }

    for (let i = 0; i < count - 1; i += 1) {
      const topCurrent = i * 2;
      const bottomCurrent = i * 2 + 1;
      const topNext = (i + 1) * 2;
      const bottomNext = (i + 1) * 2 + 1;
      indices.push(topCurrent, bottomCurrent, topNext);
      indices.push(bottomCurrent, bottomNext, topNext);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    return geometry;
  }, [currentPoints2D, height, isEmpty, trackRender, fillDepth]);
  const fillGeometryKey = useMemo(() => {
    const count = currentPoints2D ? currentPoints2D.length / 2 : 0;
    return `${trackRender}:${isEmpty ? "empty" : "full"}:${String(count)}`;
  }, [currentPoints2D, isEmpty, trackRender]);

  useLayoutEffect(() => {
    fillGeometryRef.current = fillGeometry ?? null;
  }, [fillGeometry]);

  useEffect(() => {
    return () => {
      if (fillGeometry) {
        fillGeometry.dispose();
      }
    };
  }, [fillGeometry]);

  const updateLineGeometry = useCallback(
    (points2D: Float32Array) => {
      const count = points2D.length / 2;
      let positions = linePositionsRef.current;
      if (!positions || positions.length !== count * 3) {
        positions = new Float32Array(count * 3);
        linePositionsRef.current = positions;
      }
      for (let i = 0; i < count; i += 1) {
        const srcOffset = i * 2;
        const dstOffset = i * 3;
        positions[dstOffset] = points2D[srcOffset];
        positions[dstOffset + 1] = points2D[srcOffset + 1];
        positions[dstOffset + 2] = lineZ;
      }
      if (lineRef.current) {
        lineRef.current.geometry.setPositions(positions);
      }
      if (hitLineRef.current) {
        hitLineRef.current.geometry.setPositions(positions);
      }
    },
    [lineZ],
  );

  const updateFillGeometry = useCallback(
    (points2D: Float32Array) => {
      if (!fillGeometryRef.current) return;
      if (trackRender !== TrackRender.Preview && trackRender !== TrackRender.Transition) return;
      if (isEmpty) return;
      const count = points2D.length / 2;
      if (count < 2) return;
      const baseline = -height * 0.4;
      const baselineExtension = height * 0.1;
      const effectiveBaseline = baseline - Math.abs(baselineExtension);
      let positions = fillPositionsRef.current;
      if (!positions || positions.length !== count * 2 * 3) {
        positions = new Float32Array(count * 2 * 3);
        fillPositionsRef.current = positions;
      }
      for (let i = 0; i < count; i += 1) {
        const topIndex = i * 2;
        const bottomIndex = topIndex + 1;
        const pointOffset = i * 2;
        const pointX = points2D[pointOffset];
        const pointY = points2D[pointOffset + 1];
        const baseOffset = topIndex * 3;
        const bottomOffset = bottomIndex * 3;
        positions[baseOffset] = pointX;
        positions[baseOffset + 1] = pointY;
        positions[baseOffset + 2] = fillDepth;
        positions[bottomOffset] = pointX;
        positions[bottomOffset + 1] = effectiveBaseline;
        positions[bottomOffset + 2] = fillDepth;
      }
      const positionAttribute = fillGeometryRef.current.getAttribute("position") as
        | THREE.BufferAttribute
        | undefined;
      if (positionAttribute) {
        positionAttribute.copyArray(positions);
        positionAttribute.needsUpdate = true;
      }
    },
    [fillDepth, height, isEmpty, trackRender],
  );

  useEffect(() => {
    if (!currentPoints2D) return;
    const activeMorph = morphingRef.current && morphStateRef.current;
    if (activeMorph) {
      updateLineGeometry(morphStateRef.current!.from);
      updateFillGeometry(morphStateRef.current!.from);
      return;
    }
    updateLineGeometry(currentPoints2D);
    updateFillGeometry(currentPoints2D);
  }, [currentPoints2D, updateLineGeometry, updateFillGeometry]);

  useMotionValueEvent(morphProgress, "change", (value) => {
    if (!morphingRef.current) return;
    const state = morphStateRef.current;
    if (!state || state.from.length !== state.to.length) return;
    let buffer = morphBufferRef.current;
    if (!buffer || buffer.length !== state.to.length) {
      buffer = new Float32Array(state.to.length);
      morphBufferRef.current = buffer;
    }
    for (let i = 0; i < state.to.length; i += 1) {
      const from = state.from[i];
      const to = state.to[i];
      buffer[i] = from + (to - from) * value;
    }
    updateLineGeometry(buffer);
    updateFillGeometry(buffer);
    if (value >= 1) {
      morphingRef.current = false;
      morphStateRef.current = null;
    }
  });

  const clickLine = useAnimationStore((state) => state.clickLine);
  const dragState = useAnimationStore((state) => state.dragState);
  const [isHovered, setIsHovered] = useState(false);
  const isInteractive =
    !isEmpty &&
    (layer === LayerBand.ForegroundSelected || layer === LayerBand.ForegroundUnselected);
  const hoverColor = useMemo(
    () => computeOklabMix(bufferColor, theme === Theme.Dark ? "#FFFFFF" : "#000000", 0.4),
    [bufferColor, theme],
  );
  const emphasize = isInteractive && isRowHovered;
  const lineDisplayColor = emphasize ? hoverColor : bufferColor;
  const fillDisplayColor = color;
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

  useLayoutEffect(() => {
    const prevRender = prevRenderRef.current;
    const fromPoints = prevPoints2DRef.current;
    const renderChanged = prevRender !== trackRender;
    if (
      renderChanged &&
      fromPoints &&
      currentPoints2D &&
      fromPoints.length === currentPoints2D.length
    ) {
      morphStateRef.current = { from: fromPoints, to: currentPoints2D };
      morphingRef.current = true;
      updateLineGeometry(fromPoints);
      updateFillGeometry(fromPoints);
    } else {
      morphingRef.current = false;
      morphStateRef.current = null;
    }
    if (currentPoints2D) {
      prevPoints2DRef.current = currentPoints2D;
    }
    prevRenderRef.current = trackRender;
  }, [trackRender, currentPoints2D, updateLineGeometry, updateFillGeometry]);

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

  if (!materializedSample || linePointsWithDepth.length === 0) {
    return null;
  }

  return (
    <group>
      {(trackRender === TrackRender.Preview || trackRender === TrackRender.Transition) &&
        !isEmpty &&
        fillGeometry && (
          <mesh key={fillGeometryKey}>
            <primitive object={fillGeometry} attach="geometry" />
            <meshBasicMaterial
              color={fillDisplayColor}
              transparent
              opacity={0.5}
              side={THREE.DoubleSide}
            />
          </mesh>
        )}
      <group
        onPointerEnter={handlePointerEnter}
        onPointerOut={handlePointerOut}
        onClick={(event) => {
          if (justFinishedDraggingRef.current) {
            event?.stopPropagation?.();
            return;
          }
          if (!isInteractive) return;
          event?.stopPropagation?.();
          clickLine(
            sourceRow.id,
            `${segment.startKeypointId}:${segment.endKeypointId}`,
            event.shiftKey,
            event.metaKey || event.ctrlKey,
          );
        }}
      >
        <Line
          ref={lineRef as any}
          points={linePointsWithDepth}
          color={lineDisplayColor}
          lineWidth={lineWidth + (isRowHovered ? 0.5 : 0)}
          opacity={isEmpty && trackRender === TrackRender.Transition ? 0 : 1}
          transparent
          dashed={false}
          depthWrite={false}
          depthTest
        />
        <Line
          ref={hitLineRef as any}
          points={linePointsWithDepth}
          color={DEFAULT_COLOR}
          lineWidth={8}
          opacity={0}
          transparent
          dashed={false}
          depthWrite={false}
          depthTest
        />
      </group>
    </group>
  );
});
