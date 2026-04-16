import { LayerBand } from "../types";
import type {
  ComputedRowData,
  SelectionState,
  SelectionAnchor,
  MarkerPoint,
  KeypointAddress,
  SelectionFrame,
  RenderMarker,
} from "../types";
import { buildTrackKey } from "../utils/track-key";

const FOREGROUND_LAYERS = new Set<LayerBand>([
  LayerBand.ForegroundSelected,
  LayerBand.ForegroundUnselected,
]);

const isSelectablePoint = (point: { selectable?: boolean }): boolean => point.selectable ?? true;

/**
 * Create an empty selection state. Optionally seed with a known instance id.
 */
export function createEmptySelectionState(instanceId: string | null = null): SelectionState {
  return {
    instanceId,
    keypoints: new Map(),
    reference: null,
    targetedTracks: new Set(),
    targetAnchor: null,
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
    .filter((point) => point.instanceId === instanceId && isSelectablePoint(point))
    .map((point) => ({ trackId: point.trackId, keypointId: point.markerId }));
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
    targetedTracks: selection.targetedTracks,
    targetAnchor: selection.targetAnchor,
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
  const frames = resolveSelectionFrames(row);
  if (!frames.length) return [];

  const start = frames.find((frame) => frame.id === startMarkerId);
  const end = frames.find((frame) => frame.id === endMarkerId);
  if (!start || !end) return [];

  const minStamp = Math.min(start.stamp, end.stamp);
  const maxStamp = Math.max(start.stamp, end.stamp);

  const selected: KeypointAddress[] = [];

  for (const frame of frames) {
    if (frame.stamp < minStamp || frame.stamp > maxStamp) continue;
    const addresses = extractKeypointsFromFrame(frame, instanceId);
    selected.push(...addresses);
  }

  return dedupeKeypoints(selected);
}

export function extractKeypointsFromFrame(
  frame: SelectionFrame,
  instanceId: string,
): KeypointAddress[] {
  return frame.points
    .filter((point) => point.instanceId === instanceId && isSelectablePoint(point))
    .map((point) => ({ trackId: point.trackId, keypointId: point.markerId }));
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

function resolveSelectionFrames(row: ComputedRowData | undefined): SelectionFrame[] {
  if (row?.selection) {
    return row.selection;
  }
  if (!row?.virtualFrames?.length) return [];

  return row.virtualFrames.map((frame) => ({
    id: frame.id,
    stamp: frame.stamp,
    points: frame.points.map((point) => ({
      markerId: point.id,
      trackId: point.trackId,
      trackKey: buildTrackKey(point.namespaceId, point.instanceId, point.trackId),
      namespaceId: point.namespaceId,
      instanceId: point.instanceId,
      selectable: point.selectable,
    })),
  }));
}

interface LegacyMarkerPoint {
  id: string;
  trackId: string;
  instanceId?: string;
  selectable?: boolean;
  layerBand?: LayerBand;
}

function buildMarkerKey(trackKey: string, markerId: string): string {
  return `${trackKey}#${markerId}`;
}

function buildMarkerLookup(markers: RenderMarker[]): Map<string, RenderMarker> {
  const lookup = new Map<string, RenderMarker>();
  for (const marker of markers) {
    lookup.set(buildMarkerKey(marker.trackKey, marker.id), marker);
  }
  return lookup;
}

function isForegroundMarker(marker: RenderMarker): boolean {
  return marker.layerBand !== undefined && FOREGROUND_LAYERS.has(marker.layerBand);
}

/**
 * Resolve a single instance id for row-wide selection actions.
 * Returns null when multiple instances are present or no selectable foreground points exist.
 */
export function resolveSelectionInstanceIdForRow(
  selection: SelectionState,
  row: ComputedRowData | undefined,
): string | null {
  if (selection.instanceId) {
    return selection.instanceId;
  }

  const selectionFrames = row?.selection;
  if (selectionFrames) {
    const markers = row?.render?.markers ?? [];
    if (markers.length === 0) return null;
    const markerLookup = buildMarkerLookup(markers);
    const ids = new Set<string>();

    for (const frame of selectionFrames) {
      for (const point of frame.points) {
        if (!point.instanceId) continue;
        if (!isSelectablePoint(point)) continue;
        const marker = markerLookup.get(buildMarkerKey(point.trackKey, point.markerId));
        if (!marker || !isForegroundMarker(marker)) continue;
        ids.add(point.instanceId);
        if (ids.size > 1) return null;
      }
    }

    return ids.size === 1 ? (ids.values().next().value ?? null) : null;
  }

  if (!row?.virtualFrames?.length) return null;

  const ids = new Set<string>();
  for (const frame of row.virtualFrames) {
    for (const point of frame.points as LegacyMarkerPoint[]) {
      if (!point.instanceId) continue;
      if (!isSelectablePoint(point)) continue;
      if (!point.layerBand || !FOREGROUND_LAYERS.has(point.layerBand)) continue;
      ids.add(point.instanceId);
      if (ids.size > 1) return null;
    }
  }

  return ids.size === 1 ? (ids.values().next().value ?? null) : null;
}

/**
 * Collect foreground-selectable keypoints for a row and instance.
 */
export function collectRowForegroundKeypoints(
  row: ComputedRowData | undefined,
  instanceId: string,
): KeypointAddress[] {
  const selectionFrames = row?.selection;
  if (selectionFrames) {
    const markers = row?.render?.markers ?? [];
    if (markers.length === 0) return [];
    const markerLookup = buildMarkerLookup(markers);
    const result: KeypointAddress[] = [];
    const seen = new Set<string>();

    for (const frame of selectionFrames) {
      for (const point of frame.points) {
        if (point.instanceId !== instanceId) continue;
        if (!isSelectablePoint(point)) continue;
        const marker = markerLookup.get(buildMarkerKey(point.trackKey, point.markerId));
        if (!marker || !isForegroundMarker(marker)) continue;
        const signature = buildMarkerKey(point.trackKey, point.markerId);
        if (seen.has(signature)) continue;
        seen.add(signature);
        result.push({ trackId: point.trackId, keypointId: point.markerId });
      }
    }

    return result;
  }

  if (!row?.virtualFrames?.length) return [];

  const result: KeypointAddress[] = [];
  const seen = new Set<string>();

  for (const frame of row.virtualFrames as { points?: LegacyMarkerPoint[] }[]) {
    for (const point of frame.points ?? []) {
      if (point.instanceId !== instanceId) continue;
      if (!isSelectablePoint(point)) continue;
      if (!point.layerBand || !FOREGROUND_LAYERS.has(point.layerBand)) continue;
      const signature = `${point.trackId}#${point.id}`;
      if (seen.has(signature)) continue;
      seen.add(signature);
      result.push({ trackId: point.trackId, keypointId: point.id });
    }
  }

  return result;
}
