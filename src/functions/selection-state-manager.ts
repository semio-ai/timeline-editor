import type {
  ComputedRowData,
  InstancedFrameInfo,
  SelectionState,
  SelectionAnchor,
  MarkerPoint,
  KeypointAddress,
} from "../types";

/**
 * Create an empty selection state. Optionally seed with a known instance id.
 */
export function createEmptySelectionState(instanceId: string | null = null): SelectionState {
  return {
    instanceId,
    keypoints: new Map(),
    reference: null,
  };
}

/**
 * Duplicate a keypoint map so callers can treat SelectionState as immutable.
 */
export function cloneKeypointMap(map: Map<string, Set<string>>): Map<string, Set<string>> {
  const clone = new Map<string, Set<string>>();
  for (const [trackId, keypointIds] of map.entries()) {
    clone.set(trackId, new Set(keypointIds));
  }
  return clone;
}

/**
 * Normalize raw marker points into keypoint addresses, filtering by instance id.
 */
export function extractKeypoints(points: MarkerPoint[], instanceId: string): KeypointAddress[] {
  return points
    .filter((point) => point.instanceId === instanceId)
    .map((point) => ({ trackId: point.trackId, keypointId: point.id }));
}

export function addKeypoints(
  selection: SelectionState,
  keypoints: KeypointAddress[],
): SelectionState {
  const keypointMap = cloneKeypointMap(selection.keypoints);
  for (const { trackId, keypointId } of keypoints) {
    if (!keypointMap.has(trackId)) {
      keypointMap.set(trackId, new Set([keypointId]));
      continue;
    }
    keypointMap.get(trackId)!.add(keypointId);
  }

  return {
    ...selection,
    keypoints: keypointMap,
  };
}

export function removeKeypoints(
  selection: SelectionState,
  keypoints: KeypointAddress[],
): SelectionState {
  const keypointMap = cloneKeypointMap(selection.keypoints);

  for (const { trackId, keypointId } of keypoints) {
    const existing = keypointMap.get(trackId);
    if (!existing) continue;
    existing.delete(keypointId);
    if (existing.size === 0) {
      keypointMap.delete(trackId);
    }
  }

  return {
    ...selection,
    keypoints: keypointMap,
  };
}

export function replaceKeypoints(
  selection: SelectionState,
  keypoints: KeypointAddress[],
  instanceId: string,
  reference: SelectionAnchor | null,
): SelectionState {
  const keypointMap = new Map<string, Set<string>>();
  for (const { trackId, keypointId } of keypoints) {
    const set = keypointMap.get(trackId) ?? new Set<string>();
    set.add(keypointId);
    keypointMap.set(trackId, set);
  }

  return {
    instanceId,
    keypoints: keypointMap,
    reference,
  };
}

export function clearSelection(selection: SelectionState): SelectionState {
  return {
    ...selection,
    keypoints: new Map(),
    reference: null,
  };
}

export function setReference(
  selection: SelectionState,
  reference: SelectionAnchor | null,
): SelectionState {
  return {
    ...selection,
    reference,
  };
}

export function hasAllKeypoints(selection: SelectionState, keypoints: KeypointAddress[]): boolean {
  for (const { trackId, keypointId } of keypoints) {
    if (!selection.keypoints.get(trackId)?.has(keypointId)) {
      return false;
    }
  }
  return keypoints.length > 0;
}

export function isMarkerSelected(selection: SelectionState, markerPoints: MarkerPoint[]): boolean {
  if (!selection.instanceId) return false;
  const addresses = extractKeypoints(markerPoints, selection.instanceId);
  return hasAllKeypoints(selection, addresses);
}

export function collectRangeKeypoints(
  row: ComputedRowData | undefined,
  instanceId: string,
  startMarkerId: string,
  endMarkerId: string,
): KeypointAddress[] {
  if (!row?.virtualFrames?.length) return [];
  const markers = row.virtualFrames;

  const start = markers.find((frame) => frame.id === startMarkerId);
  const end = markers.find((frame) => frame.id === endMarkerId);
  if (!start || !end) return [];

  const minStamp = Math.min(start.stamp, end.stamp);
  const maxStamp = Math.max(start.stamp, end.stamp);

  const selected: KeypointAddress[] = [];

  for (const frame of markers) {
    if (frame.stamp < minStamp || frame.stamp > maxStamp) continue;
    const addresses = extractKeypointsFromFrame(frame, instanceId);
    selected.push(...addresses);
  }

  return dedupeKeypoints(selected);
}

export function extractKeypointsFromFrame(
  frame: InstancedFrameInfo,
  instanceId: string,
): KeypointAddress[] {
  return frame.points
    .filter((point) => point.instanceId === instanceId && (point.selectable ?? true))
    .map((point) => ({ trackId: point.trackId, keypointId: point.id }));
}

export function dedupeKeypoints(keypoints: KeypointAddress[]): KeypointAddress[] {
  const seen = new Set<string>();
  const result: KeypointAddress[] = [];

  for (const kp of keypoints) {
    const signature = `${kp.trackId}#${kp.keypointId}`;
    if (seen.has(signature)) continue;
    seen.add(signature);
    result.push(kp);
  }

  return result;
}
