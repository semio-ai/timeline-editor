import { useCallback, useRef } from "react";
import { useGesture } from "@use-gesture/react";
import { useThree } from "@react-three/fiber";
import { isOrthographicCamera } from "@semio/utils";
import { getDataViewportFromFrustum } from "../viewport-utils";
import type { EdgeScrollHandle } from "./use-edge-scroll";

type GestureConfig = Parameters<typeof useGesture>[1];
type DragConfig = GestureConfig & {
  threshold?: number;
  preventScroll?: boolean;
  filterTaps?: boolean;
  pointer?: { touch: boolean };
};

export interface DragGestureOptions {
  disabled?: boolean;
  dragOptions?: DragConfig;
  /**
   * Height in pixels of the visible value viewport for the active row.
   * Required to compute normalizedValueDelta for vertical drags.
   */
  pixelRangeY?: number;
  onDragStart?: (position: number) => void;
  onDrag?: (position: number, altKey: boolean) => void;
  onDragEnd?: (position: number) => void;
  /**
   * Optional 2D drag callback for consumers that need vertical normalized deltas.
   * x is the timeline position in milliseconds.
   * normalizedValueDelta is -(movementY / pixelRangeY).
   */
  onDrag2D?: (args: {
    x: number;
    normalizedValueDelta: number;
    movementX: number;
    movementY: number;
    alt: boolean;
    shift: boolean;
    meta: boolean;
  }) => void;
  /**
   * Optional edge-scroll handle for auto-scrolling the viewport when the
   * pointer approaches the canvas edge during a drag.
   *
   * TODO(animation-usability): only box-select currently passes this. Keypoint
   * drags (`data-point.tsx`) and bezier-handle drags (`bezier-handles.tsx`)
   * intentionally skip it for now — re-enabling requires UX validation that
   * the auto-scroll feels right when the cursor is dragging a value rather
   * than sweeping a selection rectangle.
   */
  edgeScroll?: EdgeScrollHandle;
}

export interface DragGestureHandlers {
  onPointerDown: (event: any) => void;
  onPointerMove: (event: any) => void;
  onPointerUp: (event: any) => void;
  onPointerCancel?: (event: any) => void;
}

/**
 * Hook for handling drag gestures in Three.js coordinate space using @use-gesture/react.
 * Converts screen coordinates to normalized timeline position (0-1) clamped to the current data viewport.
 *
 * This implementation uses @use-gesture/react which provides better drag handling that
 * continues even when the cursor moves off the element, preventing interruptions.
 */
export const useDragGestures = ({
  disabled = false,
  dragOptions,
  onDragStart,
  onDrag,
  onDragEnd,
  pixelRangeY,
  onDrag2D,
  edgeScroll,
}: DragGestureOptions): DragGestureHandlers => {
  const { camera, size } = useThree();

  // Track whether a drag is actively in progress. While active, the gesture
  // must stay enabled even if `disabled` flips due to a mid-drag re-render
  // (e.g. store update → derived recompute → interaction prop briefly undefined).
  const draggingRef = useRef(false);

  // Shift+drag axis constraint: lock to the major axis once movement exceeds
  // a threshold, then zero out the minor axis for the rest of the drag.
  const axisLockRef = useRef<"x" | "y" | null>(null);
  const AXIS_LOCK_THRESHOLD_PX = 5;

  // Convert screen movement to timeline position in ms (unbounded)
  const getTimelinePositionFromMovement = useCallback(
    (movement: number, initial: number): number => {
      if (!isOrthographicCamera(camera)) {
        return initial;
      }
      const { left: dataLeft, right: dataRight } = getDataViewportFromFrustum(
        { left: camera.left, right: camera.right },
        Math.max(1, size.width),
      );
      const dataWidth = dataRight - dataLeft;
      if (!Number.isFinite(dataWidth) || dataWidth === 0) {
        return initial;
      }
      const deltaX = (movement / size.width) * dataWidth;
      return initial + deltaX;
    },
    [camera, size.width],
  );

  // Convert pointer event to timeline position in ms (unbounded)
  const getTimelinePositionFromEvent = useCallback(
    (event: any): number => {
      if (!isOrthographicCamera(camera)) {
        return 0;
      }

      // Try to use intersection point if available (from Three.js event)
      if (event?.point) {
        return event.point.x as number;
      }

      // Fallback: convert screen position to world space (ms)
      const clientX = (event?.clientX ?? event?.nativeEvent?.clientX ?? 0) as number;
      const normalizedX = clientX / size.width;

      // For orthographic camera, map screen space to world space
      return camera.left + normalizedX * (camera.right - camera.left);
    },
    [camera, size.width],
  );

  // Use @use-gesture/react for drag handling
  const bind = useGesture(
    {
      onDrag: ({ movement: [mx, my], first, memo, event, altKey, shiftKey, metaKey }) => {
        if (disabled && !draggingRef.current) return;

        // Feed pointer position to edge-scroll engine on every frame
        if (edgeScroll && event) {
          const e = event as any;
          const clientX = e.nativeEvent?.clientX ?? e.clientX;
          const clientY = e.nativeEvent?.clientY ?? e.clientY;
          if (typeof clientX === "number" && typeof clientY === "number") {
            edgeScroll.updatePointer(clientX, clientY);
          }
        }

        // On first drag frame, capture initial position and notify consumer
        if (first) {
          draggingRef.current = true;
          axisLockRef.current = null;
          edgeScroll?.start();
          const initialPosition = getTimelinePositionFromEvent(event);
          onDragStart?.(initialPosition);
          event?.stopPropagation?.();
          return initialPosition;
        }

        // Shift+drag: constrain to the major axis once movement is significant.
        let effectiveMx = mx;
        let effectiveMy = my;
        if (shiftKey) {
          if (!axisLockRef.current) {
            const absMx = Math.abs(mx);
            const absMy = Math.abs(my);
            if (absMx > AXIS_LOCK_THRESHOLD_PX || absMy > AXIS_LOCK_THRESHOLD_PX) {
              axisLockRef.current = absMx >= absMy ? "x" : "y";
            }
          }
          if (axisLockRef.current === "x") {
            effectiveMy = 0;
          } else if (axisLockRef.current === "y") {
            effectiveMx = 0;
          }
        } else {
          axisLockRef.current = null;
        }

        // Calculate position based on movement from initial.
        // Compensate for any viewport shift from edge-scrolling: the camera
        // moved under the pointer, so the same pixel movement maps to a
        // different world position. shiftX accumulates the world-space delta.
        const initialPosition = memo as number;
        const edgeShift = edgeScroll?.shiftX.current ?? 0;
        const position = getTimelinePositionFromMovement(effectiveMx, initialPosition) + edgeShift;

        // Horizontal callback (legacy)
        onDrag?.(position, altKey);

        // Vertical normalized delta for 2D consumers.
        // Account for camera vertical zoom: each screen pixel covers
        // (camera.top - camera.bottom) / viewport.height world units.
        if (typeof onDrag2D === "function") {
          let normalizedValueDelta = 0;
          if (typeof effectiveMy === "number" && typeof pixelRangeY === "number" && pixelRangeY > 0) {
            const scaleY = isOrthographicCamera(camera)
              ? (camera.top - camera.bottom) / size.height
              : 1;
            normalizedValueDelta = -(effectiveMy * scaleY) / pixelRangeY;
          }
          onDrag2D({
            x: position,
            normalizedValueDelta,
            movementX: effectiveMx,
            movementY: effectiveMy,
            alt: Boolean(altKey),
            shift: Boolean(shiftKey),
            meta: Boolean(metaKey),
          });
        }

        // Stop propagation
        event?.stopPropagation?.();

        // Return memo to persist initial position
        return initialPosition;
      },
      onDragEnd: ({ movement: [mx], memo, event }) => {
        const edgeShift = edgeScroll?.shiftX.current ?? 0;
        draggingRef.current = false;
        edgeScroll?.stop();
        if (disabled) return;

        // Calculate final position (with edge-scroll compensation)
        const initialPosition = memo as number;
        const finalPosition = getTimelinePositionFromMovement(mx, initialPosition) + edgeShift;

        onDragEnd?.(finalPosition);

        // Stop propagation
        event?.stopPropagation?.();
      },
    },
    {
      // Keep gesture enabled while a drag is in progress, even if `disabled`
      // briefly flips due to a mid-drag re-render cascade.
      enabled: !disabled || draggingRef.current,
      eventOptions: { passive: false, capture: false },
      ...(dragOptions ? { drag: dragOptions } : {}),
    },
  );

  // Return handlers that can be spread onto Three.js mesh elements
  // The bind() function returns an object with event handlers
  const handlers = bind();

  return {
    onPointerDown: handlers.onPointerDown || (() => {}),
    onPointerMove: handlers.onPointerMove || (() => {}),
    onPointerUp: handlers.onPointerUp || (() => {}),
    onPointerCancel: handlers.onPointerCancel,
  };
};

/**
 * Hook for handling viewport drag gestures (like in the minimap).
 * This is a specialized version for dragging viewport bounds.
 */
export const useViewportDragGestures = ({
  disabled = false,
  onDragStart,
  onDrag,
  onDragEnd,
  initialViewport,
  bounds,
  minWidth = 50, // Minimum viewport width in ms
  dragType = "viewport",
}: {
  disabled?: boolean;
  onDragStart?: (viewport: [number, number]) => void;
  onDrag?: (viewport: [number, number]) => void;
  onDragEnd?: (viewport: [number, number]) => void;
  initialViewport: [number, number];
  bounds?: [number, number];
  minWidth?: number;
  dragType?: "viewport" | "left" | "right";
}): Record<string, any> => {
  const { camera, size } = useThree();

  const bind = useGesture(
    {
      onDrag: ({ movement: [mx], first, memo, event }) => {
        if (disabled) return;

        event?.stopPropagation?.();

        if (first) {
          onDragStart?.(initialViewport);
          return [...initialViewport];
        }

        // Convert screen movement to normalized coordinate space
        if (!isOrthographicCamera(camera)) return;
        const worldWidth = camera.right - camera.left;
        const deltaX = (mx / size.width) * worldWidth;

        const memViewport = memo as [number, number];
        let newViewport: [number, number];

        if (dragType === "viewport") {
          // Drag entire viewport
          const viewportWidth = memViewport[1] - memViewport[0];
          let newStart = memViewport[0] + deltaX;
          if (bounds) {
            newStart = Math.max(bounds[0], Math.min(bounds[1] - viewportWidth, newStart));
          }
          const newEnd = newStart + viewportWidth;
          newViewport = [newStart, newEnd];
        } else if (dragType === "left") {
          // Drag left edge
          let potentialNewStart = Math.min(memViewport[1], memViewport[0] + deltaX);
          if (bounds) {
            potentialNewStart = Math.max(bounds[0], potentialNewStart);
          }
          const newStart = Math.min(potentialNewStart, memViewport[1] - minWidth);
          newViewport = [newStart, initialViewport[1]];
        } else {
          // Drag right edge
          let potentialNewEnd = Math.max(memViewport[0], memViewport[1] + deltaX);
          if (bounds) {
            potentialNewEnd = Math.min(bounds[1], potentialNewEnd);
          }
          const newEnd = Math.max(potentialNewEnd, memViewport[0] + minWidth);
          newViewport = [initialViewport[0], newEnd];
        }

        onDrag?.(newViewport);
        return memo as [number, number];
      },
      onDragEnd: ({ movement: [mx], memo }) => {
        if (disabled) return;

        // Calculate final viewport using same logic as onDrag
        if (!isOrthographicCamera(camera)) return;
        const worldWidth = camera.right - camera.left;
        const deltaX = (mx / size.width) * worldWidth;

        const memViewport = memo as [number, number];
        let finalViewport: [number, number];

        if (dragType === "viewport") {
          const viewportWidth = memViewport[1] - memViewport[0];
          let newStart = memViewport[0] + deltaX;
          if (bounds) {
            newStart = Math.max(bounds[0], Math.min(bounds[1] - viewportWidth, newStart));
          }
          const newEnd = newStart + viewportWidth;
          finalViewport = [newStart, newEnd];
        } else if (dragType === "left") {
          let potentialNewStart = Math.min(memViewport[1], memViewport[0] + deltaX);
          if (bounds) {
            potentialNewStart = Math.max(bounds[0], potentialNewStart);
          }
          const newStart = Math.min(potentialNewStart, memViewport[1] - minWidth);
          finalViewport = [newStart, initialViewport[1]];
        } else {
          let potentialNewEnd = Math.max(memViewport[0], memViewport[1] + deltaX);
          if (bounds) {
            potentialNewEnd = Math.min(bounds[1], potentialNewEnd);
          }
          const newEnd = Math.max(potentialNewEnd, memViewport[0] + minWidth);
          finalViewport = [initialViewport[0], newEnd];
        }

        onDragEnd?.(finalViewport);
      },
    },
    {
      enabled: !disabled,
      eventOptions: { passive: false },
    },
  );

  return bind();
};
