import { useEffect, useMemo, useRef, memo, useState, useCallback } from "react";
import { useShallow } from "zustand/shallow";
import { useGesture } from "@use-gesture/react";
import { useThree } from "@react-three/fiber";
import { Instance, Line, PositionMesh, useCursor } from "@react-three/drei";
import * as THREE from "three";
import { RawValue, usePlayerStore } from "@semio/utils";
import { Theme } from "@semio/ui";
import { useMotionValue, useMotionValueEvent, useSpring, useTransform } from "motion/react";
import { clamp } from "lodash";
import { SourceRowData, TrackRender } from "../../types";
import { useAnimationStore, useColors, useInvariantScale, useAltKeyPressed } from "../../hooks";
import { computeOklabMix, createLinearScale } from "../../functions";

const BG_MULTIPLIER = 1.2;

export interface DataPointProps {
  height?: number;
  // ID-based props for data lookup - eliminates stale data issues
  markerId: string;
  sourceRowId: string;
  // Visual props only
  theme?: Theme.Dark | Theme.Light;
  trackRender?: TrackRender;
  verticalBounds?: { min: number; max: number };
}

// KNOWN ISSUE: After dragging markers, the data prop becomes stale
// The component retains the original stamp value while the actual keypoint
// has moved in the store. This causes selection issues, particularly for
// the last selected marker in a multi-selection drag.
// This architectural issue will be resolved in Phase 2+ when components
// subscribe directly to computed store state rather than receiving props.
// See: docs/phase2-preparation.md for migration details
export const DataPoint = memo(function DataPoint({
  markerId,
  sourceRowId,
  theme = Theme.Light,
  trackRender = TrackRender.Key,
  height = 36,
  verticalBounds = { min: -18, max: 18 },
}: DataPointProps) {
  // Get fresh data from store
  const data = useAnimationStore(
    useShallow((state) => {
      const computed = state.computedRowData[sourceRowId];
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
  const startDragging = useAnimationStore(useShallow((state) => state.startDragging));
  const updateDragDelta = useAnimationStore(useShallow((state) => state.updateDragDelta));
  const commitDrag = useAnimationStore(useShallow((state) => state.commitDrag));
  const cancelDrag = useAnimationStore(useShallow((state) => state.cancelDrag));
  const playing = usePlayerStore(useShallow((state) => state.player.running));

  const activeInstanceId = useAnimationStore(
    useShallow((state) => state.selectionState.instanceId),
  );

  const selectablePoints: (SourceRowData & { id: string; value: RawValue })[] = points.filter(
    (d) => d.foreground,
  );
  const unselectablePoints: (SourceRowData & { id: string; value: RawValue })[] = points.filter(
    (d) => !d.foreground,
  );

  const selectablePointsInActiveInstance = selectablePoints.every((p) =>
    activeInstanceId ? p.instanceId === activeInstanceId : true,
  );
  // Get tracks for computing fresh frames when needed
  // const tracks = useAnimationStore(useShallow((state) => state.tracks));

  // Track initial drag position to calculate proper delta
  const initialDragPosition = useRef<number>(0);

  // Track if we just finished dragging to prevent immediate click
  const justFinishedDragging = useRef<boolean>(false);

  const isSelected = useAnimationStore(
    useShallow((state) => {
      const { selectionState } = state;
      const instanceId = selectionState.instanceId;
      if (!instanceId) return false;
      const relevantPoints = selectablePoints.filter((point) => point.instanceId === instanceId);
      if (relevantPoints.length === 0) return false;

      return relevantPoints.every((point) =>
        selectionState.keypoints.get(point.trackId)?.has(point.id),
      );
    }),
  );

  const isReference = useAnimationStore(
    useShallow((state) => {
      const reference = state.selectionState.reference;
      return reference?.rowId === sourceRowId && reference?.markerId === markerId;
    }),
  );

  const [isHovered, setIsHovered] = useState(false);
  const altPressed = useAltKeyPressed();

  const linearScale = useMemo(() => {
    const buffer = height * 0.4;
    return createLinearScale([verticalBounds.min, verticalBounds.max], [-buffer, buffer]);
  }, [height, verticalBounds]);

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
  const hasSelectablePoints = selectablePoints.length > 0;
  const hasUnselectablePoints = unselectablePoints.length > 0;

  // For TrackRender.Key: show line when there are any unselectable points
  const shouldShowLineForKey = trackRender === TrackRender.Key && hasUnselectablePoints;

  const baseColor = useColors(
    selectablePoints.length > 0
      ? selectablePoints.map((p) => p.trackId)
      : points.map((p) => p.trackId),
  );
  // Always call the hook, but only use it if needed
  const unselectablePointColors = useColors(
    unselectablePoints.length > 0 ? unselectablePoints.map((p) => p.trackId) : ["default"], // Provide a fallback when there are no unselectable points
  );

  const unselectableColor = hasUnselectablePoints ? unselectablePointColors : baseColor;
  const activeAdjustedBaseColor = useMemo(() => {
    return computeOklabMix(
      baseColor,
      theme === Theme.Dark ? "#202020" : "#EFEFEF",
      selectablePointsInActiveInstance ? 0 : 0.4,
    );
  }, [selectablePointsInActiveInstance, baseColor, theme]);
  const baseBackdropColor = useMemo(() => {
    return computeOklabMix(baseColor, theme === Theme.Dark ? "#202020" : "#EFEFEF", 0.7);
  }, [baseColor, theme]);
  const hoverColor = useMemo(() => {
    return computeOklabMix(baseColor, theme === Theme.Dark ? "#FFFFFF" : "#000000", 0.4);
  }, [baseColor, theme]);
  const selectionColor = useMemo(() => {
    return computeOklabMix(baseColor, theme === Theme.Dark ? "#FFFFFF" : "#000000", 0.8);
  }, [baseColor, theme]);
  const unselectableLineColor = useMemo(() => {
    return computeOklabMix(unselectableColor, theme === Theme.Dark ? "#202020" : "#EFEFEF", 0.5);
  }, [unselectableColor, theme]);

  const showsLine = RENDERS_WITH_LINES.includes(trackRender) || shouldShowLineForKey;
  // For TrackRender.Key: only show hexagon when there are selectable points
  // For other render types: always show hexagon
  const shouldShowHexagon = trackRender === TrackRender.Key ? hasSelectablePoints : true;

  const lineOpacity = useSpring(
    showsLine ? 1 : 0,
    // A config for a stiff spring
    { stiffness: 300, damping: 20, mass: 0.5 },
  );

  useEffect(() => {
    lineOpacity.set(showsLine ? 1 : 0);
  }, [lineOpacity, showsLine]);

  const fillIndex = useMotionValue(getFillIndex(isHovered, isSelected, isReference));
  const backdropIndex = useMotionValue(getBackdropIndex(isSelected, isReference));

  const fillColor = useTransform(
    fillIndex,
    [0, 0.5, 1],
    [activeAdjustedBaseColor, hoverColor, selectionColor],
  );

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

  // Set the line opacity based on the lineOpacity spring
  useMotionValueEvent(lineOpacity, "change", (v) => {
    if (lineRef.current) {
      (lineRef.current.material as THREE.LineBasicMaterial).opacity = v;
      (lineRef.current.material as THREE.LineBasicMaterial).transparent = v < 1;
    }
  });

  // Set the y position of the instances based on the yPosition spring
  useMotionValueEvent(yPosition, "change", (y) => {
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

  // Get Three.js camera and size for coordinate conversion
  const { camera, size } = useThree();

  // Convert screen movement to timeline position (0-1)
  const getTimelinePositionFromMovement = useCallback(
    (movement: number, initial: number): number => {
      // Convert screen movement to normalized coordinate space
      const orthoCam = camera as THREE.OrthographicCamera;
      const worldWidth = orthoCam.right - orthoCam.left;
      const deltaX = (movement / size.width) * worldWidth;

      // Calculate new position
      const newPosition = initial + deltaX;
      return clamp(newPosition, 0, 1);
    },
    [camera, size.width],
  );

  // Convert pointer event to timeline position (for initial position)
  const getTimelinePositionFromEvent = useCallback(
    (event: any): number => {
      // Try to use intersection point if available (from Three.js event)
      if (event?.point) {
        return clamp(event.point.x as number, 0, 1);
      }

      // Fallback: convert screen position to normalized coordinate
      const clientX = (event?.clientX ?? event?.nativeEvent?.clientX ?? 0) as number;
      const normalizedX = clientX / size.width;

      // For orthographic camera, map screen space to world space
      const orthoCamera = camera as THREE.OrthographicCamera;
      const worldX = orthoCamera.left + normalizedX * (orthoCamera.right - orthoCamera.left);

      return clamp(worldX, 0, 1);
    },
    [camera, size.width],
  );

  // Use gesture for both click and drag handling
  const bind = useGesture(
    {
      onHover: ({ hovering }) => {
        setIsHovered(hovering ?? false);
      },
      onClick: ({ event, shiftKey, metaKey }) => {
        if (playing || justFinishedDragging.current) return;

        event.stopPropagation();

        console.log(JSON.stringify({ selectablePoints, sourceRowId, markerId, shiftKey, metaKey }));

        clickMarker(selectablePoints, sourceRowId, markerId, shiftKey, metaKey || event.ctrlKey);
      },
      onDragStart: ({ event }) => {
        if (playing) return;

        event?.stopPropagation();

        // Get initial position
        const initialPosition = getTimelinePositionFromEvent(event);
        initialDragPosition.current = initialPosition;

        // Auto-select if not already selected
        if (!isSelected) {
          clickMarker(selectablePoints, sourceRowId, markerId, false, false);
        }

        // Start dragging with current selection
        startDragging();
      },

      onDrag: ({ movement: [mx], first, event, altKey }) => {
        if (playing || first) return;

        event?.stopPropagation();

        // Calculate position based on movement from initial
        const position = getTimelinePositionFromMovement(mx, initialDragPosition.current);
        const deltaInNormalized = position - initialDragPosition.current;

        // Apply frame snapping if alt is not pressed
        const shouldSnap = !altKey && !altPressed;

        // Update drag delta in normalized space
        updateDragDelta(deltaInNormalized, shouldSnap);
      },
      onDragEnd: ({ event, canceled }) => {
        if (playing) return;

        event?.stopPropagation();

        // Set flag to prevent click event immediately after drag
        justFinishedDragging.current = true;
        // Reset flag after a short delay to allow normal clicks again
        setTimeout(() => {
          justFinishedDragging.current = false;
        }, 100);

        if (canceled) {
          // Revert the drag operation
          cancelDrag();
        } else {
          // Commit the drag operation
          commitDrag();
        }
      },
    },
    {
      enabled: !playing,
      drag: {
        threshold: 3, // Require 3px movement before starting drag
        preventScroll: true,
        filterTaps: true, // This ensures clicks aren't treated as drags
        pointer: { touch: false }, // Disable touch-based dragging to prevent conflicts
      },
      eventOptions: { passive: false },
    },
  );

  // Early return if data not found
  if (!data) return null;

  return (
    <group ref={groupRef as any}>
      {shouldShowHexagon && (
        <>
          <Instance
            ref={instanceRefFg}
            position={[stamp, trackRender === TrackRender.Spline ? yPosition.get() : 0, 10]}
            rotation={[Math.PI / 2, 0, 0]}
            scale={[scaleX.get(), 1, 1]}
            // eslint-dissable-next-line
            color={fillColor.get()}
            {...(bind() as any)}
          />
          {/* Render a darker hexagon in the background */}
          <Instance
            ref={instanceRefBg}
            position={[stamp, trackRender === TrackRender.Spline ? yPosition.get() : 0, 2]}
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
          [stamp, height / -2 + 1, 1],
          [stamp, height / 2 - 1, 1],
        ]}
        color={shouldShowLineForKey ? unselectableLineColor : baseColor}
        lineWidth={2}
        opacity={lineOpacity.get()}
        transparent
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
