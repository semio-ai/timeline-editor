import { describe, expect, it } from "vitest";
import type { DerivedSnapshot } from "../../types";
import type { FeedbackProvider } from "../../functions/feedback-provider";
import {
  computeDerivedState,
  selectDerivedInputs,
} from "../../subscriptions/init-derived-orchestrator";
import { getMarkerFrame } from "../selection/selection-test-helpers";
import { createCorpusStore, normalize } from "./parity/edit-corpus";

type Store = ReturnType<typeof createCorpusStore>;

const snapshot = (store: Store) => store.getState().derivedSnapshot!;

/** A leaf row holding one number track of the active instance, and its first key. */
function leafWithKey(store: Store) {
  const state = store.getState();
  const row = Object.values(state.instancedTrackSources).find((candidate) => {
    const datum = candidate.data[0];
    const track = datum && state.tracks[datum.trackId];
    return (
      !candidate.isGroup &&
      candidate.data.length === 1 &&
      datum.instanceId === state.selectionState.instanceId &&
      track &&
      track.points.length > 0 &&
      typeof track.points[0].value === "number"
    );
  })!;
  const trackId = row.data[0].trackId;
  return { row, trackId, point: state.tracks[trackId].points[0] };
}

function drawsTrack(store: Store, rowId: string, trackId: string) {
  return store.getState().instancedTrackSources[rowId]?.data.some((d) => d.trackId === trackId);
}

/** Rows present in both snapshots, split by whether they are the same object. */
function compareRows(before: DerivedSnapshot, after: DerivedSnapshot) {
  const kept: string[] = [];
  const replaced: string[] = [];
  Object.keys(after.rows).forEach((rowId) => {
    if (!before.rows[rowId]) return;
    (before.rows[rowId] === after.rows[rowId] ? kept : replaced).push(rowId);
  });
  return { kept, replaced };
}

describe("row reuse", () => {
  it("replaces exactly the rows that draw an edited track", () => {
    const store = createCorpusStore();
    const { trackId, point } = leafWithKey(store);
    const before = snapshot(store);
    store.getState().updateKeypoint(trackId, { id: point.id, value: (point.value as number) + 1 });
    const { kept, replaced } = compareRows(before, snapshot(store));
    expect(kept.length).toBeGreaterThan(0);
    expect(replaced.length).toBeGreaterThan(0);
    kept.forEach((rowId) => expect(drawsTrack(store, rowId, trackId), rowId).toBe(false));
    replaced.forEach((rowId) => expect(drawsTrack(store, rowId, trackId), rowId).toBe(true));
  });

  // Selection reaches a row through its source row (which keys it shows as
  // selected), so only rows whose source row was replaced are computed again.
  it("keeps every row whose source row a selection change left alone", () => {
    const store = createCorpusStore();
    const before = snapshot(store);
    const sourcesBefore = store.getState().instancedTrackSources;
    store.getState().selectAll();
    const sourcesAfter = store.getState().instancedTrackSources;
    const { kept, replaced } = compareRows(before, snapshot(store));
    expect(kept.length).toBeGreaterThan(0);
    kept.forEach((rowId) => expect(sourcesAfter[rowId], rowId).toBe(sourcesBefore[rowId]));
    replaced.forEach((rowId) => expect(sourcesAfter[rowId], rowId).not.toBe(sourcesBefore[rowId]));
  });

  it("keeps every row through a viewport change", () => {
    const store = createCorpusStore();
    const before = snapshot(store);
    store.getState().setVerticalViewport("parity-view", { top: 40, bottom: -40 });
    const { replaced } = compareRows(before, snapshot(store));
    expect(replaced).toEqual([]);
  });

  it("keeps the rows a drag does not reach from one drag frame to the next", () => {
    const store = createCorpusStore();
    const { row, trackId, point } = leafWithKey(store);
    const frame = getMarkerFrame(store, row.id, point.id);
    store.getState().clickMarker(frame.points ?? [], row.id, frame.id, false, false);
    store.getState().startDrag({ axis: "horizontal", markerId: frame.id, rowId: row.id });
    store.getState().updateDrag({ normalizedStamp: { current: 0.4 }, modifiers: {} as never });
    const before = snapshot(store);
    store.getState().updateDrag({ normalizedStamp: { current: 0.6 }, modifiers: {} as never });
    const { kept, replaced } = compareRows(before, snapshot(store));
    expect(kept.length).toBeGreaterThan(0);
    kept.forEach((rowId) => expect(drawsTrack(store, rowId, trackId), rowId).toBe(false));
    expect(replaced).toContain(row.id);
    store.getState().cancelDrag();
  });

  it("carries a kept row's render samples into the new build as the same objects", () => {
    const store = createCorpusStore();
    const { trackId, point } = leafWithKey(store);
    const before = snapshot(store);
    store.getState().updateKeypoint(trackId, { id: point.id, value: (point.value as number) + 1 });
    const after = snapshot(store);
    const { kept } = compareRows(before, after);
    let checked = 0;
    kept.forEach((rowId) =>
      after.rows[rowId].computed.render?.segments.forEach((segment) =>
        Object.values(segment.samples).forEach((sample) => {
          if (sample?.kind !== "shared") return;
          expect(after.renderSampleCache?.samples[sample.sampleId], sample.sampleId).toBe(
            before.renderSampleCache?.samples[sample.sampleId],
          );
          expect(after.renderSampleCache?.samples[sample.sampleId]).toBeDefined();
          checked += 1;
        }),
      ),
    );
    expect(checked).toBeGreaterThan(0);
  });
});

// A provider may hand back the same array for a result that did not change,
// and this one always does. A row's violations then never tell it that its
// track, its animatable or the evaluator changed, so reuse has to see those
// changes for itself.
describe("row reuse with a provider whose answers never change", () => {
  const none: never[] = [];
  const provider: FeedbackProvider = {
    canonical: (subjects) => new Map(subjects.map((subject) => [subject.trackKey, none])),
    preview: () => none,
  };

  const matchesFresh = (store: Store) => {
    const fresh = computeDerivedState(selectDerivedInputs(store.getState()), 0, provider);
    expect(normalize(snapshot(store))).toEqual(normalize(fresh));
  };

  it("redraws a row whose track changed", () => {
    const store = createCorpusStore();
    store.setState({ feedbackProvider: provider });
    const { trackId, point } = leafWithKey(store);
    store.getState().updateKeypoint(trackId, { id: point.id, value: (point.value as number) + 3 });
    matchesFresh(store);
  });

  it("redraws a row whose animatable's limits changed", () => {
    const store = createCorpusStore();
    store.setState({ feedbackProvider: provider });
    const { trackId } = leafWithKey(store);
    const animatableId = store.getState().tracks[trackId].animatableId;
    const animatables = store.getState().animatables;
    const animatable = animatables[animatableId] as { constraints?: Record<string, unknown> };
    store.setState({
      animatables: {
        ...animatables,
        [animatableId]: {
          ...animatables[animatableId],
          constraints: { ...animatable.constraints, min: -500, max: 500 },
        } as (typeof animatables)[string],
      },
    });
    matchesFresh(store);
  });

  it("redraws every row's curves when the evaluator goes", () => {
    const store = createCorpusStore();
    store.setState({ feedbackProvider: provider });
    store.setState({ trackEvaluator: undefined });
    matchesFresh(store);
  });
});
