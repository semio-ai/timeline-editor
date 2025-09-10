import type { InstancedFrameInfo } from "../types";

export function compareInstancedFrames(
  a: InstancedFrameInfo,
  b: InstancedFrameInfo,
): FrameComparison {
  // Extract unique point IDs from each frame
  const aPointIds = new Set(a.points.map((point) => point.id));
  const bPointIds = new Set(b.points.map((point) => point.id));

  // Count common point IDs
  const intersection = [...aPointIds].filter((id) => bPointIds.has(id));
  const intersectionSize = intersection.length;

  // Check for incompatible case: different stamps but common points
  if (a.stamp !== b.stamp && intersectionSize > 0) {
    return FrameComparison.Incompatible;
  }

  // Check if sets are equal (same stamp and same point IDs)
  if (aPointIds.size === bPointIds.size && [...aPointIds].every((id) => bPointIds.has(id))) {
    return FrameComparison.Equal;
  }

  // Check if disjoint (no common elements)
  if (intersectionSize === 0) {
    return FrameComparison.Disjoint;
  }

  // Check if a is subset of b (all elements of a are in b)
  if (intersectionSize === aPointIds.size) {
    return FrameComparison.Subset;
  }

  // Check if a is superset of b (all elements of b are in a)
  if (intersectionSize === bPointIds.size) {
    return FrameComparison.Superset;
  }

  // Otherwise, they have partial overlap
  return FrameComparison.Partial;
}

export enum FrameComparison {
  Equal = "equal",
  Incompatible = "incompatible",
  Disjoint = "disjoint",
  Subset = "subset",
  Superset = "superset",
  Partial = "partial",
}

/**
 * Compare two instanced frames ignoring stamp differences.
 * This is useful during drag operations where virtual frames have different stamps
 * but represent the same logical markers.
 *
 * @param a - First frame to compare
 * @param b - Second frame to compare
 * @returns FrameComparison result based only on point IDs, not stamps
 */
export function compareInstancedFramesIgnoringStamp(
  a: InstancedFrameInfo,
  b: InstancedFrameInfo,
): FrameComparison {
  // Extract unique point IDs from each frame
  const aPointIds = new Set(a.points.map((point) => point.id));
  const bPointIds = new Set(b.points.map((point) => point.id));

  // Count common point IDs
  const intersection = [...aPointIds].filter((id) => bPointIds.has(id));
  const intersectionSize = intersection.length;

  // Check if sets are equal (same point IDs, ignoring stamps)
  if (aPointIds.size === bPointIds.size && [...aPointIds].every((id) => bPointIds.has(id))) {
    return FrameComparison.Equal;
  }

  // Check if disjoint (no common elements)
  if (intersectionSize === 0) {
    return FrameComparison.Disjoint;
  }

  // Check if a is subset of b (all elements of a are in b)
  if (intersectionSize === aPointIds.size) {
    return FrameComparison.Subset;
  }

  // Check if a is superset of b (all elements of b are in a)
  if (intersectionSize === bPointIds.size) {
    return FrameComparison.Superset;
  }

  // Otherwise, they have partial overlap
  return FrameComparison.Partial;
}
