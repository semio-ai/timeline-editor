import { describe, expect, it } from "vitest";
import { TrackRender, VerticalAxis, type DerivedSnapshot } from "../../types";
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

  it("redraws a row whose instance plays at another speed", () => {
    const store = createCorpusStore();
    store.setState({ feedbackProvider: provider });
    const { row } = leafWithKey(store);
    const { namespaceId, instanceId } = row.data[0];
    const namespaces = store.getState().namespaces;
    const namespace = namespaces[namespaceId];
    const instance = namespace.animationInstances[instanceId];
    store.getState().setNamespaces({
      ...namespaces,
      [namespaceId]: {
        ...namespace,
        animationInstances: {
          ...namespace.animationInstances,
          [instanceId]: { ...instance, settings: { ...instance.settings, timescale: 2 } },
        },
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

describe("row reuse around views and drags", () => {
  // In a spline view with a uniform axis every row shares one range, so a
  // change to one row's bounds moves the axes of rows that are otherwise
  // unchanged: those must come out as new objects with the new axes.
  it("replaces a kept row whose shared axis moved", () => {
    const store = createCorpusStore();
    store.getState().updateView("parity-view", {
      trackRender: TrackRender.Spline,
      verticalAxis: VerticalAxis.Uniform,
    });
    const { trackId } = leafWithKey(store);
    const animatableId = store.getState().tracks[trackId].animatableId;
    const animatables = store.getState().animatables;
    const before = snapshot(store);
    store.setState({
      animatables: {
        ...animatables,
        [animatableId]: {
          ...animatables[animatableId],
          constraints: { min: -100000, max: 100000 },
        } as (typeof animatables)[string],
      },
    });
    const after = snapshot(store);
    const fresh = computeDerivedState(selectDerivedInputs(store.getState()), 0);
    expect(normalize(after)).toEqual(normalize(fresh));
    const moved = Object.keys(after.rows).filter(
      (rowId) =>
        before.rows[rowId] &&
        !drawsTrack(store, rowId, trackId) &&
        JSON.stringify(before.rows[rowId].computed.verticalAxisByView) !==
          JSON.stringify(after.rows[rowId].computed.verticalAxisByView),
    );
    expect(moved.length).toBeGreaterThan(0);
    moved.forEach((rowId) => expect(after.rows[rowId], rowId).not.toBe(before.rows[rowId]));
  });

  // A row reads the drag's anchor even while focus is on another instance,
  // where no preview shows: the anchor row takes the anchor's frame id, which
  // lists the frame's keys. When a key leaves that frame meanwhile, a reused
  // anchor row would keep listing it.
  it("recomputes the anchor row of a drag whose instance lost focus", () => {
    const store = createCorpusStore();
    const state = store.getState();
    const anchor = Object.values(state.instancedTrackSources)
      .filter(
        (row) => row.data.length > 1 && row.data[0].instanceId === state.selectionState.instanceId,
      )
      .map((row) => ({
        row,
        frame: state.derivedSnapshot!.rows[row.id]?.computed.selection?.find(
          (candidate) => (candidate.points?.length ?? 0) > 1,
        ),
      }))
      .find(({ frame }) => frame)!;
    const { row, frame } = { row: anchor.row, frame: anchor.frame! };
    store.getState().clickMarker(frame.points ?? [], row.id, frame.id, false, false);
    store.getState().startDrag({ axis: "horizontal", markerId: frame.id, rowId: row.id });
    const other = Object.values(store.getState().namespaces)
      .flatMap((namespace) => Object.keys(namespace.animationInstances))
      .find((id) => id !== store.getState().selectionState.instanceId)!;
    const check = (where: string) => {
      const fresh = computeDerivedState(selectDerivedInputs(store.getState()), 0);
      expect(normalize(snapshot(store)), where).toEqual(normalize(fresh));
    };
    store.getState().focusSelectionInstance(other);
    check("after focus moved");
    // One of the frame's keys leaves it.
    const leaving = frame.points![1];
    const leavingTrack = store.getState().tracks[leaving.trackId];
    const leavingPoint = leavingTrack.points.find((p) => p.id === leaving.markerId)!;
    store
      .getState()
      .updateKeypoint(leavingTrack.id, { id: leavingPoint.id, stamp: leavingPoint.stamp + 123 });
    check("after a key left the anchor frame");
    store.getState().cancelDrag();
    check("after cancel");
  });
});
