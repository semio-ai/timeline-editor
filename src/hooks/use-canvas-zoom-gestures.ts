import { useCallback, useRef } from "react";
import {
  type AnyHandlerEventTypes,
  FullGestureState,
  type GestureHandlers,
  type UserGestureConfig,
  useGesture,
} from "@use-gesture/react";
import { clamp } from "lodash";
import type { RegionBounds } from "../components/three/layout/types";
import { useCameraSync, screenToNormalized } from "./use-camera-sync";

export interface CanvasZoomGesturesOptions {
  /** Region bounds for coordinate conversion */
  bounds: RegionBounds;
  /** Whether gestures are enabled */
  enabled?: boolean;
  /** Custom gesture configuration */
  config?: UserGestureConfig;
  /** Additional gesture handlers to merge */
  otherHandlers?: GestureHandlers<AnyHandlerEventTypes>;
}

/**
 * Custom hook for handling zoom/pan gestures in R3F Canvas.
 *
 * This is an adapted version of the original useZoomGestures that works
 * with the new camera synchronization system and R3F's event handling.
 *
 * @param ref - Reference to the target element (Canvas)
 * @param options - Configuration options for gestures
 */
export function useCanvasZoomGestures(
  ref: React.RefObject<HTMLElement>,
  { bounds, enabled = true, config, otherHandlers }: CanvasZoomGesturesOptions,
) {
  const { zoom, pan, viewport, updateZoom, updateViewport } = useCameraSync();

  // Track pinch timestamps for Safari duplicate event handling
  const pinchTimestamps = useRef(new Set<number>());

  const onPinch = useCallback(
    ({ event, offset: [scale], timeStamp, origin }: FullGestureState<"pinch">) => {
      if (!enabled) return;

      event.preventDefault();
      event.stopPropagation();

      // Skip Safari duplicate events
      if (pinchTimestamps.current.has(timeStamp)) {
        return;
      }

      // Maintain timestamp cache (limit size for memory)
      if (pinchTimestamps.current.size > 16) {
        pinchTimestamps.current.clear();
      }
      pinchTimestamps.current.add(timeStamp);

      // Convert pinch origin to normalized viewport position
      const normalizedPos = screenToNormalized(origin[0], origin[1], {
        left: bounds.position.x - bounds.dimensions.width / 2,
        top: bounds.position.y - bounds.dimensions.height / 2,
        width: bounds.dimensions.width,
        height: bounds.dimensions.height,
      });

      // Map to current viewport for zoom center calculation
      const viewportCenter = viewport[0] + normalizedPos.x * (viewport[1] - viewport[0]);
      const zoomCenter = clamp(viewportCenter, 0, 1);

      // Apply zoom with minimum 1x constraint
      updateZoom(Math.max(1, scale), zoomCenter);
    },
    [enabled, bounds, viewport, updateZoom],
  );

  const onDrag = useCallback(
    ({ movement: [mx], event, buttons }: FullGestureState<"drag">) => {
      if (!enabled) return;

      // Only handle middle mouse button or modifier+drag for panning
      const isMiddleButton = buttons === 4;
      const isModifierDrag = (event.metaKey || event.ctrlKey) && buttons === 1;

      if (!isMiddleButton && !isModifierDrag) return;

      event.preventDefault();
      event.stopPropagation();

      // Convert mouse movement to pan offset
      const panDelta = -(mx as number) / bounds.dimensions.width;
      const currentViewport = viewport;
      const newStart = currentViewport[0] + panDelta;
      const newEnd = currentViewport[1] + panDelta;

      // Apply pan with bounds checking
      if (newStart >= 0 && newEnd <= 1) {
        updateViewport(newStart, newEnd);
      } else if (newStart < 0) {
        const width = newEnd - newStart;
        updateViewport(0, width);
      } else if (newEnd > 1) {
        const width = newEnd - newStart;
        updateViewport(1 - width, 1);
      }
    },
    [enabled, bounds.dimensions.width, viewport, updateViewport],
  );

  // Calculate maximum zoom based on minimum viewport width
  const maxZoom = useCallback(() => {
    const minViewportWidth = 0.001; // 0.1% of timeline for reasonable zoom limit
    return 1 / minViewportWidth;
  }, []);

  useGesture(
    {
      ...(otherHandlers ?? {}),
      onPinch,
      onDrag,
    },
    {
      target: ref,
      pinch: {
        scaleBounds: { min: 1, max: maxZoom() },
        rubberband: true,
        modifierKey: ["metaKey", "ctrlKey"] as ["metaKey", "ctrlKey"],
        ...config?.pinch,
      },
      drag: {
        filterTaps: true,
        ...config?.drag,
      },
      eventOptions: { passive: false },
      ...config,
    },
  );

  // Return current state for monitoring
  return { zoom, pan, viewport, enabled };
}
