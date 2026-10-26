import { describe, expect, test } from "vitest";
import { testTrackEvaluator } from "../../test-fixtures/track-evaluator";
import { buildDerivedSnapshot, computeTrackViolations } from "../../functions";
import { computeDragDiffOps, applyTrackDiffOpsToPoints } from "../../functions/drag-diff-ops";
import { buildTrackKey } from "../../utils/track-key";
import { createMinimalAnimationStore, createTestAnimationStore } from "../../test-fixtures";
import { createEmptySelectionState } from "../../functions/selection-state-manager";
import type { DragState, TrackKey, Track } from "../../types";
import { TRACK_IDS } from "../../test-fixtures/animation-store-factory";
import { flushMicrotasks } from "../utils/flush-microtasks";

describe("drag preview funnel", () => {
  test("violations during drag match violations after applying the same deltas", () => {
    const store = createMinimalAnimationStore({ trackEvaluator: testTrackEvaluator });
    const state = store.getState();

    const rowId = Object.keys(state.instancedTrackSources)[0];
    const trackId = TRACK_IDS.SCALE;
    const track = state.tracks[trackId];
    const anchorPoint = track.points.find((p) => p.id === "s2");
    if (!anchorPoint || typeof anchorPoint.value !== "number") {
      throw new Error("Expected numeric anchor point for test");
    }

    const selectionState = createEmptySelectionState("main");
    selectionState.keypoints.set(trackId, new Set([anchorPoint.id]));

    const dragState: DragState = {
      axis: "vertical",
      instanceId: "main",
      instanceTransform: { offset: 0, timescale: 1 },
      anchor: {
        keypointId: anchorPoint.id,
        trackId,
        rowId,
        valueScale: { domain: [0, 2], clamp: false },
      },
      anchorValueOrigin: anchorPoint.value,
      normalizedValueDelta: 5, // large upward move to trigger constraint violations
      modifiers: { alt: false, shift: false, meta: false },
    };

    const snapshotBefore = buildDerivedSnapshot({
      trackEvaluator: testTrackEvaluator,
      tracks: state.tracks,
      namespaces: state.namespaces,
      animations: state.animations,
      animatables: state.animatables,
      instancedTrackSources: state.instancedTrackSources,
      dragState: undefined,
      selectionState,
      version: 0,
    });

    const snapshotDuring = buildDerivedSnapshot({
      trackEvaluator: testTrackEvaluator,
      tracks: state.tracks,
      namespaces: state.namespaces,
      animations: state.animations,
      animatables: state.animatables,
      instancedTrackSources: state.instancedTrackSources,
      dragState,
      selectionState,
      version: 1,
    });

    // Apply the same drag diffs to produce a post-commit track state.
    // Pass constraint bounds to match the preview path (computeRowData passes
    // constraintBoundsByTrack when the animatable defines both min and max).
    const scaleAnimatable = state.animatables[track.animatableId];
    const scaleConstraints =
      scaleAnimatable?.type === "number" &&
      typeof scaleAnimatable.constraints?.min === "number" &&
      typeof scaleAnimatable.constraints?.max === "number"
        ? { min: scaleAnimatable.constraints.min, max: scaleAnimatable.constraints.max }
        : undefined;
    const { diffs } = computeDragDiffOps({
      trackId,
      trackPoints: track.points,
      dragState,
      selection: selectionState,
      constraintBounds: scaleConstraints,
    });
    const committedPoints = applyTrackDiffOpsToPoints(track.points, diffs);
    const committedTracks = {
      ...state.tracks,
      [trackId]: { ...track, points: committedPoints },
    };

    const snapshotAfter = buildDerivedSnapshot({
      trackEvaluator: testTrackEvaluator,
      tracks: committedTracks,
      namespaces: state.namespaces,
      animations: state.animations,
      animatables: state.animatables,
      instancedTrackSources: state.instancedTrackSources,
      dragState: undefined,
      selectionState,
      version: 2,
    });

    const trackKey: TrackKey = buildTrackKey("default", "main", trackId);
    const before = snapshotBefore.tracks[trackKey]?.canonical.violations ?? [];
    const during = snapshotDuring.tracks[trackKey]?.canonical.violations ?? [];
    const after = snapshotAfter.tracks[trackKey]?.canonical.violations ?? [];

    const normalize = (violations: typeof during) =>
      [...violations]
        .map((v) => ({
          type: v.type,
          trackId: v.trackId,
          start: v.stampRange.start,
          end: v.stampRange.end,
        }))
        .sort((a, b) => a.start - b.start || a.type.localeCompare(b.type));

    // Canonical should not change during drag
    expect(normalize(during)).toEqual(normalize(before));
    // Canonical should change after commit
    expect(normalize(after)).not.toEqual(normalize(before));

    // Row preview during drag should reflect the committed result
    const rowDuring = snapshotDuring.rows[rowId]?.computed.violationSet;
    const normalizedRowDuring = normalize(Object.values(rowDuring?.violations ?? []));
    expect(normalizedRowDuring).toEqual(normalize(after));
  });

  test("handle-driven clamp mismatch: preview violations differ from post-commit when handle overshoots", () => {
    const store = createMinimalAnimationStore({ trackEvaluator: testTrackEvaluator });
    const state = store.getState();
    const rowId = Object.keys(state.instancedTrackSources)[0];
    const trackId = TRACK_IDS.SCALE;
    const track = state.tracks[trackId] as Track<number>;
    const anchorPoint = track.points.find((p) => p.id === "s0");
    if (!anchorPoint) throw new Error("Missing anchor point");

    const selectionState = createEmptySelectionState("main");
    selectionState.keypoints.set(trackId, new Set([anchorPoint.id]));

    // Simulate a handle drag that pulls the outbound handle far to the left (requires clamping).
    const dragState: DragState = {
      axis: "both",
      instanceId: "main",
      instanceTransform: { offset: 0, timescale: 1 },
      anchor: {
        keypointId: anchorPoint.id,
        trackId,
        rowId,
        valueScale: { domain: [0, 10], clamp: false },
      },
      anchorValueOrigin: anchorPoint.value,
      modifiers: { alt: false, shift: false, meta: false },
      handleDiffs: {
        [anchorPoint.id]: {
          out: { x: -0.6, y: 5 }, // drives cp1.x well before the anchor (will be clamped in preview)
        },
      },
    };

    const baseSnapshot = buildDerivedSnapshot({
      trackEvaluator: testTrackEvaluator,
      tracks: state.tracks,
      namespaces: state.namespaces,
      animations: state.animations,
      animatables: state.animatables,
      instancedTrackSources: state.instancedTrackSources,
      dragState: undefined,
      selectionState,
      version: 1,
    });

    const canonicalViolations: Partial<
      Record<TrackKey, ReturnType<typeof computeTrackViolations>>
    > = {};
    Object.entries(baseSnapshot.tracks).forEach(([key, derived]) => {
      canonicalViolations[key as TrackKey] = derived.canonical.violations;
    });

    const rowDuring = buildDerivedSnapshot({
      trackEvaluator: testTrackEvaluator,
      tracks: state.tracks,
      namespaces: state.namespaces,
      animations: state.animations,
      animatables: state.animatables,
      instancedTrackSources: state.instancedTrackSources,
      dragState,
      selectionState,
      version: 2,
    }).rows[rowId].computed;

    // Commit the handle diff into the track (raw, unclamped)
    const committedTrack: Track<number> = {
      ...track,
      points: track.points.map((p) =>
        p.id === anchorPoint.id
          ? {
              ...p,
              transitions: {
                ...(p.transitions ?? {}),
                out: dragState.handleDiffs?.[anchorPoint.id]?.out,
              },
            }
          : p,
      ),
    };
    const committedTracks = { ...state.tracks, [trackId]: committedTrack };

    const committedSnapshot = buildDerivedSnapshot({
      trackEvaluator: testTrackEvaluator,
      tracks: committedTracks,
      namespaces: state.namespaces,
      animations: state.animations,
      animatables: state.animatables,
      instancedTrackSources: state.instancedTrackSources,
      dragState: undefined,
      selectionState,
      version: 3,
    });
    const committedViolations =
      committedSnapshot.tracks[buildTrackKey("default", "main", trackId)]?.canonical.violations ??
      [];

    // Compute row after commit using committed violations (no preview mode)
    const rowAfter = committedSnapshot.rows[rowId].computed;

    const duringViolations = Object.values(rowDuring.violationSet.violations);
    const afterViolations = Object.values(rowAfter.violationSet.violations);

    const normalize = (list: typeof duringViolations) =>
      list
        .map((v) => ({
          type: v.type,
          start: v.stampRange.start,
          end: v.stampRange.end,
        }))
        .sort((a, b) => a.start - b.start || a.type.localeCompare(b.type));

    // Preview and post-commit should align (clamped transitions unified).
    expect(normalize(duringViolations)).toEqual(normalize(afterViolations));
    // Sanity: committed snapshot canonical matches its own violation set
    expect(normalize(committedViolations)).toEqual(normalize(afterViolations));
  });

  test("row-level violations match canonical track violations during handle drag (global view parity)", () => {
    const store = createMinimalAnimationStore({ trackEvaluator: testTrackEvaluator });
    const state = store.getState();
    const rowId = Object.keys(state.instancedTrackSources)[0];
    const trackId = TRACK_IDS.SCALE;
    const track = state.tracks[trackId] as Track<number>;
    const anchorPoint = track.points.find((p) => p.id === "s0");
    if (!anchorPoint) throw new Error("Missing anchor point");

    const selectionState = createEmptySelectionState("main");
    selectionState.keypoints.set(trackId, new Set([anchorPoint.id]));

    const dragState: DragState = {
      axis: "both",
      instanceId: "main",
      instanceTransform: { offset: 0, timescale: 1 },
      anchor: {
        keypointId: anchorPoint.id,
        trackId,
        rowId,
        valueScale: { domain: [0, 10], clamp: false },
      },
      anchorValueOrigin: anchorPoint.value,
      modifiers: { alt: false, shift: false, meta: false },
      handleDiffs: {
        [anchorPoint.id]: {
          out: { x: -0.4, y: 3 }, // force clamping/preview differences if any
        },
      },
    };

    const snapshot = buildDerivedSnapshot({
      trackEvaluator: testTrackEvaluator,
      tracks: state.tracks,
      namespaces: state.namespaces,
      animations: state.animations,
      animatables: state.animatables,
      instancedTrackSources: state.instancedTrackSources,
      dragState,
      selectionState,
      version: 1,
    });

    const committedTrack: Track<number> = {
      ...track,
      points: track.points.map((point) =>
        point.id === anchorPoint.id
          ? {
              ...point,
              transitions: {
                ...(point.transitions ?? {}),
                out: dragState.handleDiffs?.[anchorPoint.id]?.out,
              },
            }
          : point,
      ),
    };
    const committedSnapshot = buildDerivedSnapshot({
      trackEvaluator: testTrackEvaluator,
      tracks: { ...state.tracks, [trackId]: committedTrack },
      namespaces: state.namespaces,
      animations: state.animations,
      animatables: state.animatables,
      instancedTrackSources: state.instancedTrackSources,
      dragState: undefined,
      selectionState,
      version: 2,
    });

    const trackKey: TrackKey = buildTrackKey("default", "main", trackId);
    const committedViolations = committedSnapshot.tracks[trackKey]?.canonical.violations ?? [];
    const rowViolationSet = snapshot.rows[rowId]?.computed.violationSet;
    if (!rowViolationSet) throw new Error("Row missing violation set");

    const normalizedCommitted = committedViolations
      .filter((v) => v.trackId === trackId)
      .map((v) => ({ type: v.type, start: v.stampRange.start, end: v.stampRange.end }))
      .sort((a, b) => a.start - b.start || a.type.localeCompare(b.type));

    const normalizedRow = Object.values(rowViolationSet.violations)
      .filter((v) => v.trackId === trackId)
      .map((v) => ({ type: v.type, start: v.stampRange.start, end: v.stampRange.end }))
      .sort((a, b) => a.start - b.start || a.type.localeCompare(b.type));

    expect(normalizedRow).toEqual(normalizedCommitted);

    // Also validate consolidated/global row matches canonical during drag.
    const globalRow = snapshot.rows.global?.computed?.violationSet;
    if (globalRow) {
      const normalizedGlobal = Object.values(globalRow.violations)
        .filter((v) => v.trackId === trackId)
        .map((v) => ({ type: v.type, start: v.stampRange.start, end: v.stampRange.end }))
        .sort((a, b) => a.start - b.start || a.type.localeCompare(b.type));

      expect(normalizedGlobal).toEqual(normalizedCommitted);
    }
  });

  test("global row violations match canonical when dragging via store actions", async () => {
    const store = createMinimalAnimationStore({ trackEvaluator: testTrackEvaluator });

    const initialSnapshot = store.getState().derivedSnapshot;
    if (!initialSnapshot) {
      throw new Error("Expected derived snapshot to be initialized");
    }

    const trackId = TRACK_IDS.SCALE;
    const trackKey: TrackKey = buildTrackKey("default", "main", trackId);

    // Locate the primary row and marker for this track
    const rowEntry = Object.entries(initialSnapshot.rows).find(([, row]) =>
      row.trackKeys.includes(trackKey),
    );
    if (!rowEntry) throw new Error("Row containing track not found");
    const [rowId, row] = rowEntry;

    const markerFrame = row.computed.selection?.find((frame) =>
      frame.points.some((p) => p.trackId === trackId),
    );
    if (!markerFrame) throw new Error("Marker frame not found for track");
    const markerPoint = markerFrame?.points.find((p) => p.trackId === trackId);
    if (!markerPoint) throw new Error("Marker point not found");

    // Seed selection to match UI expectations
    const selectionState = createEmptySelectionState("main");
    selectionState.keypoints.set(trackId, new Set([markerPoint.markerId]));
    store.setState((state) => ({ ...state, selectionState }));
    await flushMicrotasks();

    // Start a vertical drag from the UI entrypoints
    store.getState().startDrag({
      axis: "vertical",
      rowId,
      markerId: markerFrame.id,
    });
    await flushMicrotasks();

    // Apply a vertical delta to generate violations
    store.getState().updateDrag({
      normalizedValueDelta: 4,
      modifiers: { alt: false, shift: false, meta: false },
    });
    await flushMicrotasks();

    const duringSnapshot = store.getState().derivedSnapshot;
    if (!duringSnapshot) throw new Error("Missing during-drag snapshot");

    const canonicalBefore =
      initialSnapshot.tracks[trackKey]?.canonical.violations?.filter(
        (v) => v.trackId === trackId,
      ) ?? [];
    const canonicalDuring =
      duringSnapshot.tracks[trackKey]?.canonical.violations?.filter((v) => v.trackId === trackId) ??
      [];
    const rowDuring = duringSnapshot.rows[rowId]?.computed.violationSet;
    if (!rowDuring) throw new Error("Missing row during-drag");
    const globalDuring = duringSnapshot.rows.global?.computed.violationSet;

    const normalizeViolations = (list: typeof canonicalDuring) =>
      list
        .map((v) => ({
          type: v.type,
          start: v.stampRange.start,
          end: v.stampRange.end,
          trackId: v.trackId,
        }))
        .sort((a, b) => a.start - b.start || a.type.localeCompare(b.type));

    const normalizedCanonicalDuring = normalizeViolations(canonicalDuring);
    const normalizedCanonicalBefore = normalizeViolations(canonicalBefore);
    // Canonical should remain unchanged during drag
    expect(normalizedCanonicalDuring).toEqual(normalizedCanonicalBefore);

    const normalizedRowDuring = normalizeViolations(Object.values(rowDuring.violations));
    expect(normalizedRowDuring).not.toEqual(normalizedCanonicalDuring);
    if (globalDuring) {
      const normalizedGlobalDuring = normalizeViolations(Object.values(globalDuring.violations));
      expect(normalizedGlobalDuring).not.toEqual(normalizedCanonicalDuring);
    }

    // Commit drag through the store and verify parity holds
    store.getState().commitDrag();
    await flushMicrotasks();

    const afterSnapshot = store.getState().derivedSnapshot;
    if (!afterSnapshot) throw new Error("Missing post-commit snapshot");

    const canonicalAfter =
      afterSnapshot.tracks[trackKey]?.canonical.violations?.filter((v) => v.trackId === trackId) ??
      [];
    const rowAfter = afterSnapshot.rows[rowId]?.computed.violationSet;
    const globalAfter = afterSnapshot.rows.global?.computed.violationSet;
    if (!rowAfter) throw new Error("Missing row after commit");

    const normalizedCanonicalAfter = normalizeViolations(canonicalAfter);
    // Canonical should change after commit
    expect(normalizedCanonicalAfter).not.toEqual(normalizedCanonicalBefore);

    const normalizedRowAfter = normalizeViolations(Object.values(rowAfter.violations));
    expect(normalizedRowAfter).toEqual(normalizedCanonicalAfter);
    if (globalAfter) {
      const normalizedGlobalAfter = normalizeViolations(Object.values(globalAfter.violations));
      expect(normalizedGlobalAfter).toEqual(normalizedCanonicalAfter);
    }
  });

  test("global row uses preview violations during marker drag in multi-instance store", async () => {
    const store = createTestAnimationStore({ trackEvaluator: testTrackEvaluator });
    await flushMicrotasks();

    const initialSnapshot = store.getState().derivedSnapshot;
    if (!initialSnapshot) throw new Error("Expected snapshot");

    const namespaceId = "namespace-alpha";
    const instanceId = "alpha-shared-instance";
    const trackId = TRACK_IDS.SCALE;
    const trackKey: TrackKey = buildTrackKey(namespaceId, instanceId, trackId);

    const rowEntry = Object.entries(initialSnapshot.rows).find(([, row]) =>
      row.trackKeys.includes(trackKey),
    );
    if (!rowEntry) throw new Error("Row containing track not found");
    const [rowId, row] = rowEntry;

    const markerFrame = row.computed.selection?.find((frame) =>
      frame.points.some((p) => p.trackId === trackId),
    );
    if (!markerFrame) throw new Error("Marker frame not found");
    const markerPoint = markerFrame.points.find((p) => p.trackId === trackId);
    if (!markerPoint) throw new Error("Marker point not found");

    // Seed selection to the active instance
    const selectionState = createEmptySelectionState(instanceId);
    selectionState.keypoints.set(trackId, new Set([markerPoint.markerId]));
    store.setState((state) => ({ ...state, selectionState }));
    await flushMicrotasks();

    store.getState().startDrag({
      axis: "vertical",
      rowId,
      markerId: markerFrame.id,
    });
    await flushMicrotasks();

    store.getState().updateDrag({
      normalizedValueDelta: 3,
      modifiers: { alt: false, shift: false, meta: false },
    });
    await flushMicrotasks();

    const beforeSnapshot = initialSnapshot;
    const duringSnapshot = store.getState().derivedSnapshot;
    if (!duringSnapshot) throw new Error("Missing during snapshot");

    const canonicalBefore =
      beforeSnapshot.tracks[trackKey]?.canonical.violations?.filter(
        (v) => v.trackId === trackId && v.instanceId === instanceId,
      ) ?? [];
    const canonicalDuring =
      duringSnapshot.tracks[trackKey]?.canonical.violations?.filter(
        (v) => v.trackId === trackId && v.instanceId === instanceId,
      ) ?? [];

    const rowBefore = beforeSnapshot.rows[rowId]?.computed.violationSet;
    const rowDuring = duringSnapshot.rows[rowId]?.computed.violationSet;
    const globalBefore = beforeSnapshot.rows.global?.computed.violationSet;
    const globalDuring = duringSnapshot.rows.global?.computed.violationSet;
    if (!rowBefore || !rowDuring) throw new Error("Row violation set missing");

    const normalize = (list: typeof canonicalDuring) =>
      list
        .filter((v) => v.trackId === trackId && v.instanceId === instanceId)
        .map((v) => ({
          type: v.type,
          start: v.stampRange.start,
          end: v.stampRange.end,
          trackId: v.trackId,
          instanceId: v.instanceId,
        }))
        .sort((a, b) => a.start - b.start || a.type.localeCompare(b.type));

    // Canonical should be unchanged during drag
    expect(normalize(canonicalDuring)).toEqual(normalize(canonicalBefore));

    const derivedRowBefore = normalize(Object.values(rowBefore.violations));
    const derivedRowDuring = normalize(Object.values(rowDuring.violations));
    expect(derivedRowDuring).not.toEqual(derivedRowBefore);

    if (globalBefore && globalDuring) {
      const derivedGlobalBefore = normalize(Object.values(globalBefore.violations));
      const derivedGlobalDuring = normalize(Object.values(globalDuring.violations));
      expect(derivedGlobalDuring).not.toEqual(derivedGlobalBefore);
    }

    store.getState().commitDrag();
    await flushMicrotasks();

    const afterSnapshot = store.getState().derivedSnapshot;
    if (!afterSnapshot) throw new Error("Missing after snapshot");
    const canonicalAfter =
      afterSnapshot.tracks[trackKey]?.canonical.violations?.filter(
        (v) => v.trackId === trackId && v.instanceId === instanceId,
      ) ?? [];
    const rowAfter = afterSnapshot.rows[rowId]?.computed.violationSet;
    const globalAfter = afterSnapshot.rows.global?.computed.violationSet;
    if (!rowAfter) throw new Error("Row violation set missing after commit");

    const normalizedCanonicalAfter = normalize(canonicalAfter);

    // Canonical should change after commit
    expect(normalizedCanonicalAfter).not.toEqual(normalize(canonicalBefore));

    // Derived after should reflect canonical after
    expect(normalize(Object.values(rowAfter.violations))).toEqual(normalizedCanonicalAfter);
    if (globalAfter) {
      expect(normalize(Object.values(globalAfter.violations))).toEqual(normalizedCanonicalAfter);
    }
  });
});
