import type { AnimationStore } from "../../store";
import type { KeypointAddress, MarkerPoint, SelectionFrame, SelectionState } from "../../types";

export interface ModifierOptions {
  shift?: boolean;
  mod?: boolean;
}

export function getMarkerFrame(
  store: AnimationStore,
  rowId: string,
  markerId: string,
): SelectionFrame {
  const state = store.getState();
  const row = state.derivedSnapshot?.rows?.[rowId]?.computed;
  if (!row) {
    throw new Error(`Row "${rowId}" not found.`);
  }

  const byId = row.selection?.find((candidate) => candidate.id === markerId);
  if (byId) return byId;

  const byPoint = row.selection?.find((candidate) =>
    candidate.points?.some((point) => point.markerId === markerId),
  );
  if (byPoint) return byPoint;

  throw new Error(`Marker "${markerId}" not found in row "${rowId}".`);
}

export function getMarkerPoints(
  store: AnimationStore,
  rowId: string,
  markerId: string,
): MarkerPoint[] {
  const frame = getMarkerFrame(store, rowId, markerId);
  return (frame.points ?? []).filter((point) => point.selectable ?? true);
}

export function clickMarkerWith(
  store: AnimationStore,
  rowId: string,
  markerId: string,
  options: ModifierOptions = {},
): MarkerPoint[] {
  const frame = getMarkerFrame(store, rowId, markerId);
  const points = (frame.points ?? []).filter((point) => point.selectable ?? true);
  store.getState().clickMarker(points, rowId, frame.id, options.shift, options.mod);
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
    const isSelectable = point.selectable ?? true;
    if (point.instanceId === instanceId && isSelectable) {
      signatures.add(`${point.trackId}:${point.markerId}`);
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
  frame: SelectionFrame;
  points: MarkerPoint[];
}

export function findMarker(
  store: AnimationStore,
  markerId: string,
  predicate?: (rowId: string) => boolean,
): FoundMarker {
  const state = store.getState();
  for (const rowId of Object.keys(state.instancedTrackSources)) {
    const row = state.derivedSnapshot?.rows?.[rowId]?.computed;
    if (!row) continue;
    if (predicate && !predicate(rowId)) continue;
    const frame =
      row.selection?.find((candidate) => candidate.id === markerId) ??
      row.selection?.find((candidate) =>
        candidate.points?.some((point) => point.markerId === markerId),
      );
    if (!frame) {
      continue;
    }
    const points = (frame.points ?? []).filter((point) => point.selectable ?? true);
    return { rowId, frame, points };
  }

  throw new Error(
    `Marker "${markerId}" not found${predicate ? " in rows matching predicate" : ""}.`,
  );
}

export function resolveMarkerFrameId(
  store: AnimationStore,
  rowId: string,
  markerId: string,
): string {
  return getMarkerFrame(store, rowId, markerId).id;
}
