import { useEffect, useMemo, useRef, memo, useState, useCallback } from "react";
import { useShallow } from "zustand/shallow";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import { Instance, Line, PositionMesh, useCursor } from "@react-three/drei";
import * as THREE from "three";
import { RawValue, usePlayerStore, closestFrame } from "@semio/utils";
import { Theme } from "@semio/ui";
import { useMotionValue, useMotionValueEvent, useSpring, useTransform } from "motion/react";
import { SourceRowData, TrackRender, LayerBand, VerticalAxisRange } from "../../types";
import {
  useAnimationStore,
  useColors,
  useInvariantScale,
  useAltKeyPressed,
  useDragGestures,
} from "../../hooks";
import { computeOklabMix, createLinearScale } from "../../functions";
import { ROW_DEPTH_EPSILON, LAYER_BAND_OFFSETS, LAYER_BAND_PRIORITY } from "../../constants";

const BG_MULTIPLIER = 1.2;
type PointerGestureEvent = ThreeEvent<MouseEvent>;

export interface DataPointProps {
  height?: number;
  // ID-based props for data lookup - eliminates stale data issues
  markerId: string;
  sourceRowId: string;
  // Visual props only
  theme?: Theme.Dark | Theme.Light;
  trackRender?: TrackRender;
  verticalBounds?: { min: number; max: number };
  verticalAxisRange?: VerticalAxisRange;
}

export const DataPoint = memo(function DataPoint({
  markerId,
  sourceRowId,
  theme = Theme.Light,
  trackRender = TrackRender.Key,
  height = 36,
  verticalBounds = { min: -18, max: 18 },
  verticalAxisRange,
}: DataPointProps) {
  // Get fresh data from store
  const data = useAnimationStore(
    useShallow((state) => {
      const computed = state.derivedSnapshot?.rows?.[sourceRowId]?.computed;
      return computed?.virtualFrames.find((f) => f.id === markerId);
    }),
  );
  const { stamp, points } = data ?? {
    stamp: 0,
    points: [] as (SourceRowData & { id: string; value: RawValue })[],
  };

  const sourceCount = points.length;
  const instanceRefFg = useRef<PositionMesh>(null);
  const instanceRefBg = useRef<PositionMesh>(null);
  const lineRef = useRef<THREE.Line>(null);
  const groupRef = useRef<THREE.Group>(null);

  const clickMarker = useAnimationStore(useShallow((state) => state.clickMarker));
  const startDragAction = useAnimationStore(useShallow((state) => state.startDrag));
  const updateDragAction = useAnimationStore(useShallow((state) => state.updateDrag));
  const commitDrag = useAnimationStore(useShallow((state) => state.commitDrag));
  const cancelDrag = useAnimationStore(useShallow((state) => state.cancelDrag));
  const duration = useAnimationStore(useShallow((state) => state.duration));
  const framerate = useAnimationStore(useShallow((state) => state.framerate));
  const { playing, playerDuration } = usePlayerStore(
    useShallow((state) => ({
      playing: state.player.running,
      playerDuration: state.player.duration,
    })),
  );
  const selectionState = useAnimationStore(useShallow((state) => state.selectionState));

  const unselectedForegroundPoints = points.filter(
    (d) => d.layerBand === LayerBand.ForegroundUnselected,
  );
  const selectedForegroundPoints = points.filter(
    (d) => d.layerBand === LayerBand.ForegroundSelected,
  );
  const backgroundPoints = points.filter((d) => d.layerBand === LayerBand.Background);

  const combinedForegroundPoints = useMemo(
    () => [...unselectedForegroundPoints, ...selectedForegroundPoints],
    [unselectedForegroundPoints, selectedForegroundPoints],
  );

  // Track initial drag position to calculate proper delta

  // Track if we just finished dragging to prevent immediate click
  const justFinishedDragging = useRef<boolean>(false);
  const dragDidMoveRef = useRef<boolean>(false);
  const dragStartPointerRef = useRef<number | null>(null);
  const dragAnchorStampRef = useRef<number | null>(null);

  const selectedInstanceId = selectionState.instanceId;
  const selectedKeypoints = selectionState.keypoints;
  const selectedPoints = useMemo(() => {
    if (!selectedInstanceId) return [];
    return combinedForegroundPoints.filter((point) => {
      if (point.instanceId !== selectedInstanceId) return false;
      const trackSelections = selectedKeypoints.get(point.trackId);
      return trackSelections ? trackSelections.has(point.id) : false;
    });
  }, [combinedForegroundPoints, selectedInstanceId, selectedKeypoints]);

  const isSelected = selectedPoints.length > 0;

  const isReference = useMemo(() => {
    const reference = selectionState.reference;
    return reference?.rowId === sourceRowId && reference?.markerId === markerId;
  }, [selectionState.reference, sourceRowId, markerId]);

  const [isHovered, setIsHovered] = useState(false);
  const altPressed = useAltKeyPressed();
  const frameCount = useMemo(() => {
    const baseDuration = typeof playerDuration === "number" ? playerDuration : duration;
    if (!baseDuration || !framerate) return null;
    return Math.floor(framerate * (baseDuration / 1000));
  }, [duration, framerate, playerDuration]);

  const isSpline = trackRender === TrackRender.Spline;
  const visualScaleFactor = verticalAxisRange?.visualScale ?? 1;
  const visualOffset = verticalAxisRange?.visualOffset ?? 0;
  const valueRange = useMemo(() => {
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
  }, [height, isSpline, visualScaleFactor, visualOffset]);
  const valueRangeMin = valueRange.min;
  const valueRangeMax = valueRange.max;
  const valueRangeSpan = valueRange.span;
  const linearScale = useMemo(() => {
    if (!isSpline) {
      return () => 0;
    }
    const domainMin = verticalBounds.min;
    const domainMax = verticalBounds.max;
    const domainSpan = domainMax - domainMin;
    if (!Number.isFinite(domainSpan) || domainSpan === 0) {
      return () => valueRangeMin;
    }
    return createLinearScale([domainMin, domainMax], [valueRangeMin, valueRangeMax]);
  }, [isSpline, verticalBounds.min, verticalBounds.max, valueRangeMin, valueRangeMax]);
  const pixelRangeY = isSpline ? Math.max(valueRangeSpan, 1) : undefined;
  const dragValueScale = useMemo(() => {
    if (!isSpline) return undefined;
    const domainMin = verticalBounds.min;
    const domainMax = verticalBounds.max;
    const domainSpan = domainMax - domainMin;
    if (!Number.isFinite(domainSpan) || domainSpan === 0) {
      return undefined;
    }
    return {
      domain: [domainMin, domainMax] as [number, number],
      clamp: true,
    };
  }, [isSpline, verticalBounds.min, verticalBounds.max]);

  const rawInitial: number = useMemo(() => {
    if (sourceCount !== 1) return 0;
    if (points[0].type !== "number") return 0;
    if (points.length !== 1) return 0;
    const point = points[0];
    if (typeof point.value !== "number") return 0;

    return point.value;
  }, [sourceCount, points]);

  const initialValue = linearScale(rawInitial);

  const yPosition = useSpring(trackRender === TrackRender.Spline ? initialValue : 0, {
    stiffness: 300,
    damping: 30,
  });
  const dragState = useAnimationStore(useShallow((state) => state.dragState));
  const includesDraggedTrack = useMemo(() => {
    if (!dragState || !selectionState?.keypoints) return false;
    const set = new Set<string>();
    (points ?? []).forEach((p) => set.add(p.trackId));
    for (const id of set) {
      if (selectionState.keypoints.has(id)) return true;
    }
    return false;
  }, [dragState, selectionState, points]);
  const isDragActive = isSpline && includesDraggedTrack;
  const numericCurrent = useMemo(() => {
    if (sourceCount !== 1) return 0;
    if (points[0].type !== "number") return 0;
    const point = points[0];
    return typeof point.value === "number" ? point.value : 0;
  }, [sourceCount, points]);
  const immediateY = linearScale(numericCurrent);

  const gl = useThree((s) => s.gl);
  // When the _value_ or track render changes, update the spring
  useEffect(() => {
    if (trackRender === TrackRender.Spline) {
      yPosition.set(initialValue);
    } else {
      yPosition.set(0);
    }
  }, [initialValue, yPosition, trackRender]);

  // Determine rendering behavior for TrackRender.Key based on point selectability
  const hasSelectedForegroundPoints = selectedPoints.length > 0;
  const hasUnselectedForegroundPoints = combinedForegroundPoints.length - selectedPoints.length > 0;
  const hasBackgroundPoints = backgroundPoints.length > 0;

  const highestPriorityIds = useMemo(() => {
    if (selectedForegroundPoints.length > 0) {
      return selectedForegroundPoints.map((point) => point.trackId);
    } else if (unselectedForegroundPoints.length > 0) {
      return unselectedForegroundPoints.map((point) => point.trackId);
    }
    return [];
  }, [selectedForegroundPoints, unselectedForegroundPoints]);

  const vertLineIds = useMemo(() => {
    if (RENDERS_WITH_LINES.includes(trackRender)) {
      return highestPriorityIds;
    } else if (hasUnselectedForegroundPoints) {
      return unselectedForegroundPoints.map((point) => point.trackId);
    } else {
      return [];
    }
  }, [trackRender, highestPriorityIds, hasUnselectedForegroundPoints, unselectedForegroundPoints]);

  // For TrackRender.Key: show line when there are any unselectable points
  const shouldShowLineForKey = trackRender === TrackRender.Key && hasBackgroundPoints;

  const baseColor = useColors(highestPriorityIds);
  const lineColor = useColors(vertLineIds);

  const baseBackdropColor = useMemo(() => {
    return computeOklabMix(baseColor, theme === Theme.Dark ? "#202020" : "#EFEFEF", 0.7);
  }, [baseColor, theme]);
  const hoverColor = useMemo(() => {
    return computeOklabMix(baseColor, theme === Theme.Dark ? "#FFFFFF" : "#000000", 0.4);
  }, [baseColor, theme]);
  const selectionColor = useMemo(() => {
    return computeOklabMix(baseColor, theme === Theme.Dark ? "#FFFFFF" : "#000000", 0.8);
  }, [baseColor, theme]);

  const showsLine = RENDERS_WITH_LINES.includes(trackRender) || shouldShowLineForKey;
  // For key render, only show hexagon when there are foreground points; otherwise always show
  const shouldShowHexagon = combinedForegroundPoints.length > 0;

  const fillIndex = useMotionValue(getFillIndex(isHovered, isSelected, isReference));
  const backdropIndex = useMotionValue(getBackdropIndex(isSelected, isReference));

  const fillColor = useTransform(fillIndex, [0, 0.5, 1], [baseColor, hoverColor, selectionColor]);

  const backdropColor = useTransform(
    backdropIndex,
    [0, 0.5, 1],
    [baseBackdropColor, baseColor, selectionColor],
  );

  useEffect(() => {
    fillIndex.set(getFillIndex(isHovered, isSelected, isReference));
  }, [fillIndex, isHovered, isSelected, isReference]);

  useEffect(() => {
    backdropIndex.set(getBackdropIndex(isSelected, isReference));
  }, [backdropIndex, isSelected, isReference]);

  useCursor(isHovered, "pointer", "auto", gl.domElement);

  const bgScale = useSpring(isSelected ? BG_MULTIPLIER * 1.1 : BG_MULTIPLIER, {
    stiffness: 300,
    damping: 20,
    mass: 0.5,
  });

  useEffect(() => {
    bgScale.set(isSelected ? BG_MULTIPLIER * 1.1 : BG_MULTIPLIER);
  }, [isSelected, bgScale]);

  const scaleX = useInvariantScale();

  // Update the fill color when it changes
  useMotionValueEvent(fillColor, "change", (c) => {
    if (instanceRefFg.current) {
      if ("color" in instanceRefFg.current) {
        instanceRefFg.current.color.set(c);
      }
    }
  });

  // Update the backdrop color when it changes
  useMotionValueEvent(backdropColor, "change", (c) => {
    if (instanceRefBg.current) {
      if ("color" in instanceRefBg.current) {
        instanceRefBg.current.color.set(c);
      }
    }
  });

  // Set the y position of the instances based on the yPosition spring
  // During drag, bypass spring updates so visuals respond immediately
  useMotionValueEvent(yPosition, "change", (y) => {
    if (isDragActive) return;
    if (instanceRefFg.current && instanceRefBg.current) {
      instanceRefFg.current.position.y = y;
      instanceRefBg.current.position.y = y;
    }
  });

  // Update the scale to be invariant to zoom level
  useMotionValueEvent(scaleX, "change", (s) => {
    if (instanceRefFg.current && instanceRefBg.current) {
      instanceRefFg.current.scale.x = s;
      instanceRefBg.current.scale.x = s * bgScale.get(); // Background is slightly larger
      instanceRefBg.current.scale.z = bgScale.get();
    }
  });

  useMotionValueEvent(bgScale, "change", (s) => {
    if (instanceRefBg.current) {
      instanceRefBg.current.scale.x = scaleX.get() * s; // Background is slightly larger
      instanceRefBg.current.scale.z = s;
    }
  });

  const computeDragStamp = useCallback(
    (pointerX: number, modifierAlt: boolean) => {
      const timelinePointer = Math.min(1, Math.max(0, pointerX));
      const anchorTimeline = dragAnchorStampRef.current ?? stamp;
      const startPointer = dragStartPointerRef.current ?? timelinePointer;
      const raw = Math.min(1, Math.max(0, anchorTimeline + (timelinePointer - startPointer)));
      if (modifierAlt || !frameCount || frameCount <= 0) {
        return { raw, snapped: undefined };
      }
      const snapped = Math.min(1, Math.max(0, closestFrame(raw, frameCount)));
      return { raw, snapped };
    },
    [frameCount, stamp],
  );

  const dragHandlers = useDragGestures({
    disabled: playing,
    dragOptions: {
      preventScroll: true,
      filterTaps: true,
      pointer: { touch: false },
    },
    pixelRangeY,
    onDrag2D: ({ x, normalizedValueDelta, alt, shift, meta }) => {
      if (!isSpline) return;
      const resolved = computeDragStamp(x, alt || altPressed);
      updateDragAction({
        pointer: { x: resolved.raw, y: 0 },
        normalizedValueDelta,
        normalizedStamp: {
          current: resolved.raw,
          snapped: resolved.snapped,
        },
        modifiers: { alt, shift, meta },
      });
    },
    onDragStart: (_position) => {
      // Drag gesture has begun — start drag here, not on pointer down
      dragDidMoveRef.current = false;
      const clampedStart = Math.min(1, Math.max(0, _position));
      dragStartPointerRef.current = clampedStart;
      dragAnchorStampRef.current = stamp;
      if (!isSelected) {
        clickMarker(points, sourceRowId, markerId, false, false);
      }

      startDragAction({
        origin: { x: clampedStart, y: 0 },
        axis: isSpline ? "both" : "horizontal",
        markerId,
        rowId: sourceRowId,
        ...(dragValueScale ? { valueScale: dragValueScale } : {}),
      });
    },
    onDrag: (position, altKey) => {
      dragDidMoveRef.current = true;

      const resolved = computeDragStamp(position, altKey || altPressed);

      updateDragAction({
        pointer: { x: resolved.raw, y: 0 },
        normalizedStamp: {
          current: resolved.raw,
          snapped: resolved.snapped,
        },
        modifiers: {
          alt: altKey || altPressed,
          shift: false,
          meta: false,
        },
      });
    },
    onDragEnd: () => {
      if (!dragDidMoveRef.current) {
        cancelDrag();
        return;
      }

      justFinishedDragging.current = true;
      setTimeout(() => {
        justFinishedDragging.current = false;
      }, 60);
      commitDrag();
      dragDidMoveRef.current = false;
      dragStartPointerRef.current = null;
      dragAnchorStampRef.current = null;
    },
  });

  const handlePointerDown = useCallback(
    (event: PointerGestureEvent) => {
      justFinishedDragging.current = false;
      dragDidMoveRef.current = false;
      dragStartPointerRef.current = null;
      dragAnchorStampRef.current = null;

      // DEBUG:
      console.log(points, data?.transitions);

      // Allow pointer down even when no foreground points are present; drag start is handled in onDragStart
      dragHandlers.onPointerDown?.(event);
    },
    [dragHandlers, data, points],
  );

  const handlePointerMove = useCallback(
    (event: PointerGestureEvent) => {
      dragHandlers.onPointerMove?.(event);
    },
    [dragHandlers],
  );

  const handlePointerUp = useCallback(
    (event: PointerGestureEvent) => {
      dragHandlers.onPointerUp?.(event);
    },
    [dragHandlers],
  );

  const handlePointerCancel = useCallback(
    (event: PointerGestureEvent) => {
      dragHandlers.onPointerCancel?.(event);
      if (dragDidMoveRef.current) {
        justFinishedDragging.current = true;
        setTimeout(() => {
          justFinishedDragging.current = false;
        }, 60);
      }
      dragDidMoveRef.current = false;
      cancelDrag();
      dragStartPointerRef.current = null;
      dragAnchorStampRef.current = null;
    },
    [dragHandlers, cancelDrag],
  );

  const handlePointerOver = useCallback(
    (event: PointerGestureEvent) => {
      event.stopPropagation();
      if (!hasSelectedForegroundPoints && !hasUnselectedForegroundPoints) return;
      setIsHovered(true);
    },
    [hasSelectedForegroundPoints, hasUnselectedForegroundPoints],
  );

  const handlePointerOut = useCallback((event: PointerGestureEvent) => {
    event.stopPropagation();
    setIsHovered(false);
  }, []);

  const handleClick = useCallback(
    (event: PointerGestureEvent) => {
      event.stopPropagation();
      if (playing) return;

      if (points.length === 0) return;

      clickMarker(points, sourceRowId, markerId, event.shiftKey, event.metaKey || event.ctrlKey);
    },
    [playing, points, clickMarker, sourceRowId, markerId],
  );

  const resolvedBand = useMemo(() => {
    const allPoints = hasBackgroundPoints
      ? [...combinedForegroundPoints, ...backgroundPoints]
      : combinedForegroundPoints;
    if (allPoints.length === 0) {
      return LayerBand.Background;
    }
    return allPoints.reduce((current, point) => {
      const band = point.layerBand ?? LayerBand.Background;
      return LAYER_BAND_PRIORITY[band] > LAYER_BAND_PRIORITY[current] ? band : current;
    }, LayerBand.Background);
  }, [combinedForegroundPoints, backgroundPoints, hasBackgroundPoints]);

  // Early return if data not found
  if (!data) return null;

  const foregroundBand =
    resolvedBand === LayerBand.Background ? LayerBand.ForegroundUnselected : resolvedBand;
  const foregroundZ = LAYER_BAND_OFFSETS[foregroundBand];

  const backplateDepth = foregroundZ - ROW_DEPTH_EPSILON * 0.2;
  const fillDepth = foregroundZ + ROW_DEPTH_EPSILON * 0.2;
  const lineDepth = hasBackgroundPoints
    ? LAYER_BAND_OFFSETS[LayerBand.Background] + ROW_DEPTH_EPSILON * 0.1
    : foregroundZ + ROW_DEPTH_EPSILON * 0.4;
  let resolvedYPosition = 0;
  if (trackRender === TrackRender.Spline) {
    resolvedYPosition = isDragActive ? immediateY : yPosition.get();
  }

  return (
    <group
      ref={groupRef as any}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      onClick={handleClick}
    >
      {shouldShowHexagon && (
        <>
          <Instance
            ref={instanceRefFg}
            position={[stamp, resolvedYPosition, fillDepth]}
            rotation={[Math.PI / 2, 0, 0]}
            scale={[scaleX.get(), 1, 1]}
            // eslint-dissable-next-line
            color={fillColor.get()}
          />
          {/* Render a darker hexagon in the background */}
          <Instance
            ref={instanceRefBg}
            position={[stamp, resolvedYPosition, backplateDepth]}
            rotation={[Math.PI / 2, 0, 0]}
            scale={[scaleX.get() * bgScale.get(), 1, bgScale.get()]}
            // eslint-dissable-next-line
            color={backdropColor.get()}
          />
        </>
      )}
      {/* Render a vertical line at the stamp */}
      <Line
        ref={lineRef as any}
        points={[
          [stamp, height / -2 + 1, lineDepth],
          [stamp, height / 2 - 1, lineDepth],
        ]}
        color={lineColor}
        lineWidth={2.5}
        visible={showsLine}
        // Lines are non-interactive when showing unselectable points
      />
    </group>
  );
});

const RENDERS_WITH_LINES = [TrackRender.Preview, TrackRender.Transition];

function getFillIndex(isHovered: boolean, isSelected: boolean, isReference: boolean): number {
  if (isReference) return 1;
  if (isSelected) return 0;
  if (isHovered) return 0.5;
  return 0;
}

function getBackdropIndex(isSelected: boolean, isReference: boolean): number {
  if (isReference) return 0.5;
  if (isSelected) return 1;
  return 0;
}
