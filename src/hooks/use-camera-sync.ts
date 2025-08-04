import { useMemo, useCallback } from "react";
import { useShallow } from "zustand/react/shallow";
import { usePlayerStore } from "@semio/utils";

export interface CameraState {
  /** Zoom level where 1 = no zoom, 2 = 2x zoom, etc. */
  zoom: number;
  /** Pan offset in normalized coordinates (-0.5 to 0.5, where 0 = centered) */
  pan: { x: number; y: number };
  /** Current viewport bounds [0, 1] representing visible portion of timeline */
  viewport: [number, number];
}

export interface CameraActions {
  /** Update viewport bounds [0,1] (affects both zoom and pan) */
  updateViewport: (start: number, end: number) => void;
  /** Update zoom level around a specific normalized point [0,1] */
  updateZoom: (zoom: number, center?: number) => void;
  /** Update horizontal pan offset [-0.5, 0.5] while maintaining zoom */
  updatePan: (panX: number) => void;
}

/**
 * Hook for synchronizing camera state with the player store.
 *
 * Coordinate System:
 * - Player viewport: [0, 1] representing visible portion of timeline
 * - Camera zoom: 1/viewport_width (smaller viewport = higher zoom)
 * - Camera pan: viewport_center - 0.5 (offset from timeline center)
 *
 * @returns Object containing current camera state and update actions
 */
export function useCameraSync(): CameraState & CameraActions {
  const { viewport, updatePlayerViewport } = usePlayerStore(
    useShallow((state) => ({
      viewport: state.player.viewport,
      updatePlayerViewport: state.updatePlayerViewport,
    })),
  );

  // Convert viewport to camera state using mathematical transformations
  const cameraState = useMemo<CameraState>(() => {
    const viewportWidth = viewport[1] - viewport[0];
    const viewportCenter = (viewport[0] + viewport[1]) / 2;

    return {
      zoom: 1 / viewportWidth, // Inverse relationship: smaller viewport = higher zoom
      pan: {
        x: viewportCenter - 0.5, // Pan offset from center (0.5 = timeline center)
        y: 0, // Vertical pan handled separately via track scrolling
      },
      viewport: [...viewport] as [number, number],
    };
  }, [viewport]);

  const updateViewport = useCallback(
    (start: number, end: number) => {
      // Ensure viewport bounds stay within [0, 1] and start < end
      const clampedStart = Math.max(0, Math.min(1, start));
      const clampedEnd = Math.max(0, Math.min(1, end));

      if (clampedStart < clampedEnd) {
        updatePlayerViewport(clampedStart, clampedEnd);
      }
    },
    [updatePlayerViewport],
  );

  const updateZoom = useCallback(
    (zoom: number, center = 0.5) => {
      // Convert zoom level back to viewport width (inverse of zoom calculation)
      const newWidth = 1 / Math.max(1, zoom); // Minimum zoom of 1x
      const clampedCenter = Math.max(0, Math.min(1, center));

      // Calculate viewport bounds centered around zoom point
      let newStart = clampedCenter - newWidth / 2;
      let newEnd = clampedCenter + newWidth / 2;

      // Keep viewport within [0, 1] bounds by shifting if necessary
      if (newStart < 0) {
        newStart = 0;
        newEnd = newWidth;
      } else if (newEnd > 1) {
        newEnd = 1;
        newStart = 1 - newWidth;
      }

      updateViewport(newStart, newEnd);
    },
    [updateViewport],
  );

  const updatePan = useCallback(
    (panX: number) => {
      const currentWidth = viewport[1] - viewport[0];
      const newCenter = 0.5 + panX; // Convert pan offset back to absolute center position

      let newStart = newCenter - currentWidth / 2;
      let newEnd = newCenter + currentWidth / 2;

      // Maintain viewport width while keeping bounds within [0, 1]
      if (newStart < 0) {
        newStart = 0;
        newEnd = currentWidth;
      } else if (newEnd > 1) {
        newEnd = 1;
        newStart = 1 - currentWidth;
      }

      updateViewport(newStart, newEnd);
    },
    [viewport, updateViewport],
  );

  return {
    ...cameraState,
    updateViewport,
    updateZoom,
    updatePan,
  };
}

/**
 * Utility function to convert screen coordinates to normalized coordinates [0, 1]
 * within a specific region's bounds.
 *
 * @param screenX Screen X coordinate (pixels)
 * @param screenY Screen Y coordinate (pixels)
 * @param bounds Region bounds in world space
 * @returns Normalized coordinates where 0,0 is top-left and 1,1 is bottom-right
 */
export function screenToNormalized(
  screenX: number,
  screenY: number,
  bounds: { left: number; top: number; width: number; height: number },
): { x: number; y: number } {
  return {
    x: (screenX - bounds.left) / bounds.width,
    y: (screenY - bounds.top) / bounds.height,
  };
}

/**
 * Utility function to convert normalized coordinates [0, 1] to world space
 * within the current camera viewport.
 *
 * @param normalizedX Normalized X coordinate [0, 1] within viewport
 * @param cameraState Current camera state containing viewport bounds
 * @returns World space coordinate mapped to timeline position
 */
export function normalizedToWorld(normalizedX: number, cameraState: CameraState): number {
  const { viewport } = cameraState;
  return viewport[0] + normalizedX * (viewport[1] - viewport[0]);
}
