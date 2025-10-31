import { useCallback } from "react";
import { useGesture } from "@use-gesture/react";
import { useThree } from "@react-three/fiber";
import { clamp } from "lodash";
import * as THREE from "three";

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
  onDragStart?: (position: number) => void;
  onDrag?: (position: number, altKey: boolean) => void;
  onDragEnd?: (position: number) => void;
}

export interface DragGestureHandlers {
  onPointerDown: (event: any) => void;
  onPointerMove: (event: any) => void;
  onPointerUp: (event: any) => void;
  onPointerCancel?: (event: any) => void;
}

/**
 * Hook for handling drag gestures in Three.js coordinate space using @use-gesture/react.
 * Converts screen coordinates to normalized timeline position (0-1).
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
}: DragGestureOptions): DragGestureHandlers => {
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

  // Use @use-gesture/react for drag handling
  const bind = useGesture(
    {
      onDragStart: ({ event }) => {
        if (disabled) return;

        // Get initial position from the event
        const initialPosition = getTimelinePositionFromEvent(event);
        onDragStart?.(initialPosition);

        // Stop propagation to prevent conflicts
        event?.stopPropagation?.();
      },
      onDrag: ({ movement: [mx], first, memo, event, altKey }) => {
        if (disabled) return;

        // On first drag frame, store the initial position
        if (first) {
          const initialPosition = getTimelinePositionFromEvent(event);
          onDragStart?.(initialPosition);
          return initialPosition;
        }

        // Calculate position based on movement from initial
        const initialPosition = memo as number;
        const position = getTimelinePositionFromMovement(mx, initialPosition);

        onDrag?.(position, altKey);

        // Stop propagation
        event?.stopPropagation?.();

        // Return memo to persist initial position
        return initialPosition;
      },
      onDragEnd: ({ movement: [mx], memo, event }) => {
        if (disabled) return;

        // Calculate final position
        const initialPosition = memo as number;
        const finalPosition = getTimelinePositionFromMovement(mx, initialPosition);

        onDragEnd?.(finalPosition);

        // Stop propagation
        event?.stopPropagation?.();
      },
    },
    {
      enabled: !disabled,
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
  bounds = [0, 1],
  minWidth = 0.05,
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
        const orthoCam = camera as THREE.OrthographicCamera;
        const worldWidth = orthoCam.right - orthoCam.left;
        const deltaX = (mx / size.width) * worldWidth;

        const memViewport = memo as [number, number];
        let newViewport: [number, number];

        if (dragType === "viewport") {
          // Drag entire viewport
          const viewportWidth = memViewport[1] - memViewport[0];
          const newStart = Math.max(
            bounds[0],
            Math.min(bounds[1] - viewportWidth, memViewport[0] + deltaX),
          );
          const newEnd = newStart + viewportWidth;
          newViewport = [newStart, newEnd];
        } else if (dragType === "left") {
          // Drag left edge
          const potentialNewStart = Math.max(
            bounds[0],
            Math.min(memViewport[1], memViewport[0] + deltaX),
          );
          const newStart = Math.min(potentialNewStart, memViewport[1] - minWidth);
          newViewport = [newStart, initialViewport[1]];
        } else {
          // Drag right edge
          const potentialNewEnd = Math.min(
            bounds[1],
            Math.max(memViewport[0], memViewport[1] + deltaX),
          );
          const newEnd = Math.max(potentialNewEnd, memViewport[0] + minWidth);
          newViewport = [initialViewport[0], newEnd];
        }

        onDrag?.(newViewport);
        return memo as [number, number];
      },
      onDragEnd: ({ movement: [mx], memo }) => {
        if (disabled) return;

        // Calculate final viewport using same logic as onDrag
        const orthoCam = camera as THREE.OrthographicCamera;
        const worldWidth = orthoCam.right - orthoCam.left;
        const deltaX = (mx / size.width) * worldWidth;

        const memViewport = memo as [number, number];
        let finalViewport: [number, number];

        if (dragType === "viewport") {
          const viewportWidth = memViewport[1] - memViewport[0];
          const newStart = Math.max(
            bounds[0],
            Math.min(bounds[1] - viewportWidth, memViewport[0] + deltaX),
          );
          const newEnd = newStart + viewportWidth;
          finalViewport = [newStart, newEnd];
        } else if (dragType === "left") {
          const potentialNewStart = Math.max(
            bounds[0],
            Math.min(memViewport[1], memViewport[0] + deltaX),
          );
          const newStart = Math.min(potentialNewStart, memViewport[1] - minWidth);
          finalViewport = [newStart, initialViewport[1]];
        } else {
          const potentialNewEnd = Math.min(
            bounds[1],
            Math.max(memViewport[0], memViewport[1] + deltaX),
          );
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
