import type { InstancedFrameInfo } from "../types";

/**
 * Computes the next timestamp based on the provided tracks, instances, and current timestamp.
 *
 * @param data - An array of instanced frame information containing timestamps.
 * @param stamp - The current timestamp from which to compute the next timestamp.
 * @param bounds - A tuple representing the lower and upper bounds for the timestamps.
 * @param respectBounds - A boolean indicating whether to respect the upper bound when computing the next timestamp.
 * @returns The next timestamp if found, otherwise undefined.
 */
export function computeNextTime(
  data: InstancedFrameInfo[],
  stamp: number,
  bounds: [number, number],
  respectBounds: boolean,
): number | undefined {
  const EPSILON = 1e-6;
  const stamps = data.map((f) => f.stamp);
  if (stamps.length === 0) return undefined;

  // Find the next stamp after the current player stamp
  const nextStamps = stamps.filter((s) => s > stamp + EPSILON);
  if (nextStamps.length === 0) return undefined;
  const nextStampDirect = Math.min(...nextStamps);

  if (respectBounds) {
    if (nextStampDirect > bounds[1]) return undefined;
    return nextStampDirect;
  } else {
    return nextStampDirect;
  }
}

/**
 * Computes the previous timestamp from a given stamp within the provided tracks and instances.
 *
 * @param data - An array of instanced frame information containing timestamps.
 * @param stamp - The current timestamp from which to compute the previous time.
 * @param bounds - A tuple representing the lower and upper bounds within which the previous timestamp should be found.
 * @param respectBounds - A boolean indicating whether to respect the bounds when finding the previous timestamp.
 * @returns The previous timestamp if found, otherwise undefined.
 */
export function computePreviousTime(
  data: InstancedFrameInfo[],
  stamp: number,
  bounds: [number, number],
  respectBounds: boolean,
): number | undefined {
  const EPSILON = 1e-6;
  const stamps = data.map((f) => f.stamp);
  if (stamps.length === 0) return undefined;

  // Find the previous stamp before the current player stamp
  const previousStamps = stamps.filter((s) => s < stamp - EPSILON);
  if (previousStamps.length === 0) return undefined;
  const previousStampDirect = Math.max(...previousStamps);

  if (respectBounds) {
    if (previousStampDirect < bounds[0]) return undefined;
    return previousStampDirect;
  } else {
    return previousStampDirect;
  }
}
