/**
 * Essential marker utility functions
 */

import { AnimationData } from "../store-types";
import { InstancedFrameInfo } from "../types";
import { resolveComputedRowData } from "../utils/resolve-row-data";

/**
 * Helper to get fresh marker data by ID
 * @param state - The animation data state
 * @param markerId - The ID of the marker to find
 * @param sourceRowId - The source row ID containing the marker
 * @returns The marker data if found, undefined otherwise
 */
export function getMarkerById(
  state: AnimationData,
  markerId: string,
  sourceRowId: string,
): InstancedFrameInfo | undefined {
  const computedData = resolveComputedRowData(state, sourceRowId);
  if (!computedData) return undefined;

  return computedData.virtualFrames.find((f) => f.id === markerId);
}

/**
 * Get the instance ID from a marker's points
 * @param marker - The marker to get instance ID from
 * @returns The instance ID if found, undefined otherwise
 */
export function getMarkerInstanceId(marker: InstancedFrameInfo): string | undefined {
  // Instance ID is stored in SourceRowData of each point
  return marker.points[0]?.instanceId;
}
