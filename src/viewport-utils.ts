import { TIMELINE_PADDING } from "./constants";

/**
 * Utility functions for handling viewport frustum calculations with padding.
 *
 * Key concepts:
 * - Data Viewport: The bounds (in ms) where data is displayed
 * - Camera Frustum: The expanded bounds that include padding on both sides
 */

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

  // Padding scales with current viewport width to maintain consistent pixel-space padding.
  const paddingInWorldUnits = (TIMELINE_PADDING * dataWidth) / canvasWidth;

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
