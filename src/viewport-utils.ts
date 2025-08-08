import { TIMELINE_PADDING } from "./constants";

/**
 * Utility functions for handling viewport frustum calculations with padding.
 *
 * Key concepts:
 * - Data Viewport: The actual [0,1] bounds where data is displayed
 * - Camera Frustum: The expanded bounds that include padding on both sides
 */

export interface Frustum {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface DataViewport {
  left: number;
  right: number;
}

/**
 * Calculates the camera frustum bounds from a data viewport, adding padding.
 *
 * @param dataViewport - The data viewport bounds [left, right]
 * @param canvasWidth - Canvas width in pixels
 * @param isFixed - Whether this is a fixed camera (global view) or dynamic camera
 * @returns Camera frustum bounds with padding
 */
export function calculatePaddedFrustum(
  dataViewport: [number, number],
  canvasWidth: number,
  isFixed = false,
): { left: number; right: number } {
  const [dataLeft, dataRight] = dataViewport;
  const dataWidth = dataRight - dataLeft;

  // For fixed cameras, padding is based on full canvas width
  // For dynamic cameras, padding scales with current viewport to maintain pixel size
  const paddingInWorldUnits = isFixed
    ? TIMELINE_PADDING / canvasWidth
    : (TIMELINE_PADDING * dataWidth) / canvasWidth;

  return {
    left: dataLeft - paddingInWorldUnits,
    right: dataRight + paddingInWorldUnits,
  };
}

/**
 * Extracts the data viewport from a camera frustum, removing padding.
 *
 * @param frustum - The camera frustum bounds
 * @param canvasWidth - Canvas width in pixels
 * @returns Data viewport bounds without padding
 */
export function getDataViewportFromFrustum(
  frustum: { left: number; right: number },
  canvasWidth: number,
): DataViewport {
  const frustumWidth = frustum.right - frustum.left;

  // CRITICAL: Calculate data width by working backwards from frustum width
  // This prevents feedback loop that causes zoom drift during panning
  //
  // Mathematical relationship:
  // frustumWidth = dataWidth + 2 * paddingInWorldUnits
  // paddingInWorldUnits = (TIMELINE_PADDING * dataWidth) / canvasWidth
  // Therefore: frustumWidth = dataWidth + 2 * (TIMELINE_PADDING * dataWidth / canvasWidth)
  // Factoring: frustumWidth = dataWidth * (1 + 2 * TIMELINE_PADDING / canvasWidth)
  // Solving for dataWidth: dataWidth = frustumWidth / (1 + 2 * TIMELINE_PADDING / canvasWidth)
  //
  // This ensures getDataViewportFromFrustum and setFrustumFromDataViewport are mathematical inverses
  const paddingFactor = (2 * TIMELINE_PADDING) / canvasWidth;
  const dataWidth = frustumWidth / (1 + paddingFactor);
  const paddingInWorldUnits = (TIMELINE_PADDING * dataWidth) / canvasWidth;

  return {
    left: frustum.left + paddingInWorldUnits,
    right: frustum.right - paddingInWorldUnits,
  };
}

/**
 * Converts a data viewport to camera frustum bounds with padding.
 *
 * @param dataViewport - The data viewport bounds
 * @param canvasWidth - Canvas width in pixels
 * @returns Camera frustum bounds with padding
 */
export function setFrustumFromDataViewport(
  dataViewport: DataViewport,
  canvasWidth: number,
): { left: number; right: number } {
  const dataWidth = dataViewport.right - dataViewport.left;
  const paddingInWorldUnits = (TIMELINE_PADDING * dataWidth) / canvasWidth;

  return {
    left: dataViewport.left - paddingInWorldUnits,
    right: dataViewport.right + paddingInWorldUnits,
  };
}

/**
 * Calculates effective bounds for camera operations, expanding data bounds to include padding.
 *
 * @param dataBounds - The original data bounds [min, max]
 * @param currentFrustumWidth - Current camera frustum width
 * @param canvasWidth - Canvas width in pixels
 * @returns Expanded bounds that include padding space
 */
export function getEffectiveBoundsWithPadding(
  dataBounds: [number, number] | undefined,
  currentFrustumWidth: number,
  canvasWidth: number,
): [number, number] | undefined {
  if (!dataBounds) return undefined;

  const [min, max] = dataBounds;
  const paddingInWorldUnits = (TIMELINE_PADDING * currentFrustumWidth) / canvasWidth;

  return [min - paddingInWorldUnits, max + paddingInWorldUnits];
}
