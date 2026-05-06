/**
 * Line Click Selection Tests
 * Verifies row-wide selection via clickLine using the keypoint-driven selection model.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createTestAnimationStore,
  INSTANCE_IDS,
} from "../../test-fixtures/animation-store-factory";
import type { AnimationStore } from "../../store";
import { flushMicrotasks } from "../utils/flush-microtasks";
import { LayerBand } from "../../types";
import { getMarkerPoints, selectionSignatures } from "./selection-test-helpers";

/**
 * Compute expected signatures (trackId:keypointId) for all foreground, selectable
 * keypoints in a row for the provided instanceId.
 */
function rowForegroundSignatures(
  store: AnimationStore,
  rowId: string,
  instanceId: string,
): string[] {
  const state = store.getState();
  const row = state.derivedSnapshot?.rows?.[rowId]?.computed;
  if (!row) return [];

  const signatures = new Set<string>();
  const markers = row.render?.markers ?? [];
  if (row.selection) {
    if (!markers.length) return [];
    const markerLookup = new Map(
      markers.map((marker) => [`${marker.trackKey}#${marker.id}`, marker]),
    );
    for (const frame of row.selection) {
      for (const point of frame.points ?? []) {
        if (point.instanceId !== instanceId) continue;
        const isSelectable = point.selectable ?? true;
        if (!isSelectable) continue;
        const marker = markerLookup.get(`${point.trackKey}#${point.markerId}`);
        if (!marker) continue;
        if (
          marker.layerBand !== LayerBand.ForegroundSelected &&
          marker.layerBand !== LayerBand.ForegroundUnselected
        ) {
          continue;
        }
        signatures.add(`${point.trackId}:${point.markerId}`);
      }
    }
  } else {
    for (const frame of row.virtualFrames ?? []) {
      for (const point of frame.points ?? []) {
        if (point.instanceId !== instanceId) continue;
        const isSelectable = point.selectable ?? true;
        if (!isSelectable) continue;
        if (
          point.layerBand !== LayerBand.ForegroundSelected &&
          point.layerBand !== LayerBand.ForegroundUnselected
        ) {
          continue;
        }
        signatures.add(`${point.trackId}:${point.id}`);
      }
    }
  }

  return Array.from(signatures).sort();
}

/**
 * Find the first row that contains at least one selectable foreground keypoint.
 * Optionally exclude specific rowIds.
 */
function getRowTrackIds(store: AnimationStore, rowId: string): Set<string> {
  const sourceRow = store.getState().instancedTrackSources[rowId];
  const trackIds = new Set<string>();
  if (sourceRow) {
    sourceRow.data.forEach((entry) => {
      if (entry.trackId) {
        trackIds.add(entry.trackId);
      }
    });
  }
  return trackIds;
}

function findRowWithForeground(
  store: AnimationStore,
  excludeRows: Set<string> = new Set<string>(),
  excludeTrackIds: Set<string> = new Set<string>(),
): string {
  const state = store.getState();
  const rows = state.derivedSnapshot?.rows ?? {};
  for (const [rowId, snapshotRow] of Object.entries(rows)) {
    if (excludeRows.has(rowId)) continue;

    // Skip entity/instance organizational group rows — they aggregate
    // all child tracks and would conflict with track-level exclusion.
    const sourceRow = state.instancedTrackSources[rowId];
    if (sourceRow?.isGroup && (rowId.startsWith("entity:") || rowId.startsWith("instance:"))) {
      continue;
    }

    const rowTrackIds = getRowTrackIds(store, rowId);
    let conflicts = false;
    rowTrackIds.forEach((trackId) => {
      if (excludeTrackIds.has(trackId)) {
        conflicts = true;
      }
    });
    if (conflicts) continue;

    const row = snapshotRow?.computed;
    const markers = row?.render?.markers ?? [];
    const markerLookup = new Map(
      markers.map((marker) => [`${marker.trackKey}#${marker.id}`, marker]),
    );
    const hasForeground = (row?.selection ?? []).some((frame) =>
      (frame.points ?? []).some((p) => {
        const marker = markerLookup.get(`${p.trackKey}#${p.markerId}`);
        return (
          (p.selectable ?? true) &&
          Boolean(p.instanceId) &&
          marker &&
          (marker.layerBand === LayerBand.ForegroundSelected ||
            marker.layerBand === LayerBand.ForegroundUnselected)
        );
      }),
    );
    if (hasForeground) return rowId;
  }
  throw new Error("No row with foreground-selectable points found.");
}

/**
 * Pick a segment id for a row by pairing the first two frame ids if they exist.
 * Note: clickLine does not rely on segment resolution; this is for realistic inputs only.
 */
function deriveSegmentId(store: AnimationStore, rowId: string): string {
  const row = store.getState().derivedSnapshot?.rows?.[rowId]?.computed;
  const frames = row?.selection ?? [];
  if (frames.length >= 2) {
    return `${frames[0].id}:${frames[1].id}`;
  }
  if (frames.length === 1) {
    return `${frames[0].id}:${frames[0].id}`;
  }
  return "segment";
}

/**
 * Get the first marker id present in a row, if any.
 */
function getAnyMarkerIdInRow(store: AnimationStore, rowId: string): string {
  const row = store.getState().derivedSnapshot?.rows?.[rowId]?.computed;
  const frames = row?.selection ?? [];
  if (frames.length === 0) throw new Error(`No markers found in row "${rowId}"`);
  return frames[0].id;
}

describe("Click Line Action with Complete Store", () => {
  let store: AnimationStore;
  let cleanup: (() => void) | undefined;

  beforeEach(async () => {
    store = createTestAnimationStore({
      includeNamespaceA: true,
      includeNamespaceB: true,
      activeInstance: INSTANCE_IDS.ALPHA_SHARED,
    });

    cleanup = store.getState().initAnimationSubscriptions();
    // Flush microtasks so subscriptions settle without relying on timers
    await flushMicrotasks();
  });

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  it("replaces selection with row foreground on plain click and deselects on second plain click; leaves reference unchanged", () => {
    const rowId = findRowWithForeground(store);
    const segmentId = deriveSegmentId(store, rowId);

    // First click: select all row-foreground keypoints for current instance
    store.getState().clickLine(rowId, segmentId);
    const firstSelection = store.getState().selectionState;

    expect(firstSelection.instanceId).toBe(INSTANCE_IDS.ALPHA_SHARED);

    const expectedAll = rowForegroundSignatures(store, rowId, firstSelection.instanceId!);
    expect(selectionSignatures(firstSelection)).toEqual(expectedAll);

    const refBefore = firstSelection.reference;

    // Second click: row already fully selected -> deselect row foreground
    store.getState().clickLine(rowId, segmentId);
    const secondSelection = store.getState().selectionState;
    expect(selectionSignatures(secondSelection)).toEqual([]);
    // Segment clicks never modify the reference
    expect(secondSelection.reference).toEqual(refBefore);
  });

  it("cmd/ctrl toggles a row without clearing other rows; reference remains unchanged", () => {
    // Choose two distinct rows with foreground
    const rowA = findRowWithForeground(store);
    const rowATracks = getRowTrackIds(store, rowA);
    const rowB = findRowWithForeground(store, new Set([rowA]), rowATracks);

    const segA = deriveSegmentId(store, rowA);
    const segB = deriveSegmentId(store, rowB);

    // Establish a reference via a marker click in rowA
    const markerA = getAnyMarkerIdInRow(store, rowA);
    const pointsA = getMarkerPoints(store, rowA, markerA);
    // Marker click: sets selection to marker's points and records reference
    store.getState().clickMarker(pointsA, rowA, markerA);

    const afterMarker = store.getState().selectionState;
    expect(afterMarker.reference).toEqual({ rowId: rowA, markerId: markerA });

    // Plain click the line in rowA: replaces selection with full row foreground; keeps reference
    store.getState().clickLine(rowA, segA);
    const afterRowA = store.getState().selectionState;
    const expectedRowA = rowForegroundSignatures(store, rowA, afterRowA.instanceId!);
    expect(selectionSignatures(afterRowA)).toEqual(expectedRowA);
    expect(afterRowA.reference).toEqual({ rowId: rowA, markerId: markerA });

    // Cmd/Ctrl click the line in rowB: toggles rowB foreground ON, union with rowA; keeps reference
    store.getState().clickLine(rowB, segB, false, true);
    const afterToggleOn = store.getState().selectionState;
    const expectedRowB = rowForegroundSignatures(store, rowB, afterToggleOn.instanceId!);
    const union = Array.from(new Set([...expectedRowA, ...expectedRowB])).sort();
    expect(selectionSignatures(afterToggleOn)).toEqual(union);
    expect(afterToggleOn.reference).toEqual({ rowId: rowA, markerId: markerA });

    // Cmd/Ctrl click the line in rowB again: toggles rowB foreground OFF, returning to rowA; keeps reference
    store.getState().clickLine(rowB, segB, false, true);
    const afterToggleOff = store.getState().selectionState;
    expect(selectionSignatures(afterToggleOff)).toEqual(expectedRowA);
    expect(afterToggleOff.reference).toEqual({ rowId: rowA, markerId: markerA });
  });

  it("shift-clicking a different row behaves like a plain click and does not change the reference", () => {
    // Establish a reference on rowA via marker click
    const rowA = findRowWithForeground(store);
    const rowATracks = getRowTrackIds(store, rowA);
    const markerA = getAnyMarkerIdInRow(store, rowA);
    const pointsA = getMarkerPoints(store, rowA, markerA);
    store.getState().clickMarker(pointsA, rowA, markerA);
    const afterMarker = store.getState().selectionState;
    expect(afterMarker.reference).toEqual({ rowId: rowA, markerId: markerA });

    // Shift-click on a different rowB should behave as a plain click (replace selection) and keep reference
    const rowB = findRowWithForeground(store, new Set([rowA]), rowATracks);
    const segB = deriveSegmentId(store, rowB);

    store.getState().clickLine(rowB, segB, true, false);
    const afterShift = store.getState().selectionState;

    const expectedRowB = rowForegroundSignatures(store, rowB, afterShift.instanceId!);
    expect(selectionSignatures(afterShift)).toEqual(expectedRowB);
    // Reference unchanged by line-clicks
    expect(afterShift.reference).toEqual({ rowId: rowA, markerId: markerA });
  });
});
