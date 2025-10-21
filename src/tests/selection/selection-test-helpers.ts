import type { AnimationStore } from "../../store";
import type { KeypointAddress, MarkerPoint, SelectionState, InstancedFrameInfo } from "../../types";

export interface ModifierOptions {
  shift?: boolean;
  mod?: boolean;
}

export function getMarkerFrame(
  store: AnimationStore,
  rowId: string,
  markerId: string,
): InstancedFrameInfo {
  const state = store.getState();
  const row = state.computedRowData[rowId];
  if (!row) {
    throw new Error(`Row "${rowId}" not found in computedRowData.`);
  }

  const frame = row.virtualFrames?.find((candidate) => candidate.id === markerId);
  if (!frame) {
    throw new Error(`Marker "${markerId}" not found in row "${rowId}".`);
  }

  return frame;
}

export function getMarkerPoints(
  store: AnimationStore,
  rowId: string,
  markerId: string,
): MarkerPoint[] {
  const frame = getMarkerFrame(store, rowId, markerId);
  return (frame.points ?? []).filter((point) => point.selectable !== false);
}

export function clickMarkerWith(
  store: AnimationStore,
  rowId: string,
  markerId: string,
  options: ModifierOptions = {},
): MarkerPoint[] {
  const points = getMarkerPoints(store, rowId, markerId);
  store.getState().clickMarker(points, rowId, markerId, options.shift, options.mod);
  return points;
}

export function selectionSignatures(selection: SelectionState): string[] {
  const signatures: string[] = [];
  selection.keypoints.forEach((ids, trackId) => {
    ids.forEach((keypointId) => {
      signatures.push(`${trackId}:${keypointId}`);
    });
  });
  return signatures.sort();
}

export function pointsToSignatures(points: MarkerPoint[], instanceId: string | null): string[] {
  if (!instanceId) return [];
  const signatures = new Set<string>();
  for (const point of points) {
    if (point.instanceId === instanceId && point.selectable !== false) {
      signatures.add(`${point.trackId}:${point.id}`);
    }
  }
  return Array.from(signatures).sort();
}

export function keypointsToSignatures(addresses: KeypointAddress[]): string[] {
  const signatures = new Set<string>();
  for (const address of addresses) {
    signatures.add(`${address.trackId}:${address.keypointId}`);
  }
  return Array.from(signatures).sort();
}

export interface FoundMarker {
  rowId: string;
  frame: InstancedFrameInfo;
  points: MarkerPoint[];
}

export function findMarker(
  store: AnimationStore,
  markerId: string,
  predicate?: (rowId: string) => boolean,
): FoundMarker {
  const state = store.getState();
  for (const [rowId, row] of Object.entries(state.computedRowData)) {
    if (predicate && !predicate(rowId)) continue;
    const frame = row.virtualFrames?.find((candidate) => candidate.id === markerId);
    if (!frame) continue;
    const points = (frame.points ?? []).filter((point) => point.selectable !== false);
    return { rowId, frame, points };
  }

  throw new Error(
    `Marker "${markerId}" not found${predicate ? " in rows matching predicate" : ""}.`,
  );
}
