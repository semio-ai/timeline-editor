import { isEqual } from "lodash";
import { describe, expect, it, vi } from "vitest";
import {
  computeSubjectViolations,
  createTrackFeedbackProvider,
  type FeedbackProvider,
  type FeedbackSubject,
} from "../../functions/feedback-provider";
import {
  computeDerivedState,
  currentDerivedSnapshot,
  initDerivedOrchestrator,
  selectDerivedInputs,
} from "../../subscriptions/init-derived-orchestrator";
import { sharedPreviewViolations } from "../../functions/build-derived-snapshot";
import { ViolationType, type TrackKey, type Violation } from "../../types";
import { violationId } from "../../functions/compute-track-violations";
import { isFilteredSourceRowId } from "../../functions/view-filtered-source-row";
import { getMarkerFrame } from "../selection/selection-test-helpers";
import { createCorpusStore, normalize } from "./parity/edit-corpus";

type Store = ReturnType<typeof createCorpusStore>;

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

const judged = (subjects: readonly FeedbackSubject[], evaluator: unknown) =>
  new Map<TrackKey, Violation[]>(
    subjects.map((subject) => [
      subject.trackKey,
      computeSubjectViolations(subject, evaluator as never),
    ]),
  );

/**
 * Runs out the build budget with a host listener that answers every snapshot
 * with a write to an input, then removes the listener: building stays stalled
 * until the pending retry.
 */
function stallBuilding(store: Store) {
  const touchViews = () => store.setState({ editorViews: { ...store.getState().editorViews } });
  const unsubscribe = store.subscribe((s) => s.derivedSnapshot, touchViews);
  touchViews();
  unsubscribe();
  expect(vi.getTimerCount()).toBe(1);
}

/** Writes a new value to a leaf's first key, a change every snapshot shows. */
function bumpKey(store: Store) {
  const { trackId, point } = leafWithKey(store);
  const track = store.getState().tracks[trackId];
  store.setState({
    tracks: {
      ...store.getState().tracks,
      [trackId]: {
        ...track,
        points: track.points.map((p) =>
          p.id === point.id ? { ...p, value: (p.value as number) + 0.01 } : p,
        ),
      },
    },
  });
}

const isCurrent = (store: Store) =>
  JSON.stringify(normalize(store.getState().derivedSnapshot)) ===
  JSON.stringify(normalize(computeDerivedState(selectDerivedInputs(store.getState()), 0)));

describe("derived store edges", () => {
  it("never publishes a snapshot built from inputs a write replaced while it was building", () => {
    const store = createCorpusStore();
    const { trackId, point } = leafWithKey(store);
    let wrote = false;
    const provider: FeedbackProvider = {
      canonical: (subjects, evaluator) => {
        if (!wrote) {
          wrote = true;
          store.getState().updateKeypoint(trackId, { id: point.id, value: 0.123 });
        }
        return judged(subjects, evaluator);
      },
      preview: (subject, evaluator) => computeSubjectViolations(subject, evaluator),
    };
    const published: boolean[] = [];
    const unsubscribe = store.subscribe(
      (s) => s.derivedSnapshot,
      () => published.push(isCurrent(store)),
    );
    const before = store.getState().derivedSnapshot!.version!;
    store.setState({ feedbackProvider: provider });
    unsubscribe();
    expect(wrote).toBe(true);
    expect(published).toEqual([true]);
    // The build the write overtook is dropped, not published and replaced:
    // the store's own subscriptions would hear it, and a host subscribed
    // without them ahead (`initDerivedOrchestrator` alone) would too.
    expect(store.getState().derivedSnapshot!.version! - before).toBe(1);
  });

  it("publishes nothing, asks nothing and watches no provider once a snapshot listener stops the store", () => {
    vi.useFakeTimers();
    try {
      const store = createCorpusStore();
      const listeners = new Set<() => void>();
      let asks = 0;
      const provider: FeedbackProvider = {
        canonical: (subjects, evaluator) => {
          asks += 1;
          // Reports a change on every ask, so the flushes still unwinding
          // when the listener stops the store each want to build again.
          listeners.forEach((listener) => listener());
          return judged(subjects, evaluator);
        },
        preview: (subject, evaluator) => computeSubjectViolations(subject, evaluator),
        subscribe: (listener) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
      };
      let stoppedAt: number | undefined;
      let asksAtStop = 0;
      store.subscribe(
        (s) => s.derivedSnapshot,
        (snapshot) => {
          if (stoppedAt !== undefined) return;
          stoppedAt = snapshot!.version;
          store.getState().stopAnimationSubscriptions();
          asksAtStop = asks;
        },
      );
      store.setState({ feedbackProvider: provider });
      expect(stoppedAt).toBeDefined();
      expect(vi.getTimerCount()).toBe(0);
      vi.runAllTimers();
      expect(store.getState().derivedSnapshot!.version).toBe(stoppedAt);
      expect(asks).toBe(asksAtStop);
      expect(listeners.size).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("publishes nothing when the provider stops the store while it is asked", () => {
    const store = createCorpusStore();
    const before = store.getState().derivedSnapshot;
    const provider: FeedbackProvider = {
      canonical: (subjects, evaluator) => {
        store.getState().stopAnimationSubscriptions();
        return judged(subjects, evaluator);
      },
      preview: (subject, evaluator) => computeSubjectViolations(subject, evaluator),
    };
    store.setState({ feedbackProvider: provider });
    expect(store.getState().derivedSnapshot).toBe(before);
  });

  it("commits a drag where it was last moved while building is stalled", () => {
    vi.useFakeTimers();
    try {
      const drag = (store: Store, stall: () => void) => {
        const { row, trackId, point } = leafWithKey(store);
        const frame = getMarkerFrame(store, row.id, point.id);
        store.getState().clickMarker(frame.points ?? [], row.id, frame.id, false, false);
        store.getState().startDrag({ axis: "horizontal", markerId: frame.id, rowId: row.id });
        store.getState().updateDrag({ normalizedStamp: { current: 0.4 }, modifiers: {} as never });
        stall();
        store.getState().updateDrag({ normalizedStamp: { current: 0.6 }, modifiers: {} as never });
        store.getState().commitDrag();
        return store.getState().tracks[trackId].points.map((p) => p.stamp);
      };

      const control = drag(createCorpusStore(), () => {});

      const store = createCorpusStore();
      const stalled = drag(store, () => {
        // A host listener that answers every snapshot with an edit to an
        // input the drag does not touch runs out the build budget, and
        // building stalls until a retry.
        let edits = 0;
        store.subscribe(
          (s) => s.derivedSnapshot,
          () => {
            edits += 1;
            store.setState({ editorViews: { ...store.getState().editorViews } });
          },
        );
        store.setState({ editorViews: { ...store.getState().editorViews } });
        expect(vi.getTimerCount()).toBe(1);
        expect(edits).toBeGreaterThan(0);
      });
      expect(stalled).toEqual(control);
    } finally {
      vi.useRealTimers();
    }
  });

  it("builds at most one budget for an action while stalled, though a listener answers every snapshot with one", () => {
    vi.useFakeTimers();
    try {
      const store = createCorpusStore();
      const { trackId, point } = leafWithKey(store);
      let edits = 0;
      const unsubscribe = store.subscribe(
        (s) => s.derivedSnapshot,
        () => {
          edits += 1;
          store.getState().updateKeypoint(trackId, { id: point.id, value: (edits % 7) * 0.01 });
        },
      );
      store.getState().updateKeypoint(trackId, { id: point.id, value: 0.5 });
      expect(vi.getTimerCount()).toBe(1);
      // An action brings the stalled snapshot up to date before it reads it.
      // The listener answers each of those builds with an action of its own,
      // which must not start a refresh of its own, and the refresh gives up
      // after one budget.
      const version = store.getState().derivedSnapshot!.version!;
      store.getState().updateKeypoint(trackId, { id: point.id, value: 0.25 });
      const built = store.getState().derivedSnapshot!.version! - version;
      expect(built).toBeGreaterThan(0);
      expect(built).toBeLessThanOrEqual(8);
      unsubscribe();
      vi.runAllTimers();
      expect(isCurrent(store)).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("builds again for a stalled action when a write drops the build it forced", () => {
    vi.useFakeTimers();
    try {
      const drag = (stall: boolean) => {
        const store = createCorpusStore();
        let armed = false;
        store.setState({
          feedbackProvider: {
            canonical: (subjects, evaluator) => {
              if (armed) {
                armed = false;
                store.setState({ editorViews: { ...store.getState().editorViews } });
              }
              return judged(subjects, evaluator);
            },
            preview: (subject, evaluator) => computeSubjectViolations(subject, evaluator),
          },
        });
        const { row, trackId, point } = leafWithKey(store);
        const frame = getMarkerFrame(store, row.id, point.id);
        store.getState().clickMarker(frame.points ?? [], row.id, frame.id, false, false);
        store.getState().startDrag({ axis: "horizontal", markerId: frame.id, rowId: row.id });
        store.getState().updateDrag({ normalizedStamp: { current: 0.4 }, modifiers: {} as never });
        if (stall) stallBuilding(store);
        store.getState().updateDrag({ normalizedStamp: { current: 0.6 }, modifiers: {} as never });
        // The provider writes to an input while the commit's refresh asks it.
        armed = true;
        store.getState().commitDrag();
        return store.getState().tracks[trackId].points.map((p) => p.stamp);
      };
      expect(drag(true)).toEqual(drag(false));
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not recurse when a provider changes on every ask and a listener answers each snapshot", () => {
    vi.useFakeTimers();
    try {
      const store = createCorpusStore();
      const { trackId, point } = leafWithKey(store);
      const listeners = new Set<() => void>();
      store.setState({
        feedbackProvider: {
          canonical: (subjects, evaluator) => {
            listeners.forEach((listener) => listener());
            return judged(subjects, evaluator);
          },
          preview: (subject, evaluator) => computeSubjectViolations(subject, evaluator),
          subscribe: (listener) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
          },
        },
      });
      expect(vi.getTimerCount()).toBe(1);
      let edits = 0;
      const unsubscribe = store.subscribe(
        (s) => s.derivedSnapshot,
        () => {
          edits += 1;
          store.getState().updateKeypoint(trackId, { id: point.id, value: (edits % 7) * 0.01 });
        },
      );
      const version = store.getState().derivedSnapshot!.version!;
      store.getState().updateKeypoint(trackId, { id: point.id, value: 0.25 });
      expect(store.getState().derivedSnapshot!.version! - version).toBeLessThanOrEqual(8);
      unsubscribe();
      store.getState().stopAnimationSubscriptions();
    } finally {
      vi.useRealTimers();
    }
  });

  it("hears a late answer from a provider a stalled action asked first", () => {
    vi.useFakeTimers();
    try {
      const store = createCorpusStore();
      stallBuilding(store);
      const listeners = new Set<() => void>();
      let answer = 0;
      store.setState({
        feedbackProvider: {
          canonical: (subjects) =>
            new Map(
              subjects.map((subject) => [
                subject.trackKey,
                [
                  {
                    id: `late:${subject.trackKey}`,
                    trackId: subject.trackId,
                    namespace: subject.namespaceId,
                    instanceId: subject.instanceId,
                    type: "upper",
                    stampRange: { start: 0, end: answer },
                  } as Violation,
                ],
              ]),
            ),
          preview: () => [],
          subscribe: (listener) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
          },
        },
      });
      // An action while stalled builds with the new provider. Its own write
      // is to nothing the snapshot reads, so only the provider's late answer
      // calls for another build.
      store.getState().setEmphasis(null);
      answer = 1;
      listeners.forEach((listener) => listener());
      vi.runAllTimers();
      const ends = Object.values(store.getState().derivedSnapshot!.tracks).map(
        (track) => track.canonical.violations[0]?.stampRange.end,
      );
      expect(new Set(ends)).toEqual(new Set([1]));
    } finally {
      vi.useRealTimers();
    }
  });

  it("gives violations whose ids differ only in where a slash falls different ids", () => {
    expect(violationId("a/b", "c", "t", ViolationType.Upper, 0)).not.toBe(
      violationId("a", "b/c", "t", ViolationType.Upper, 0),
    );
    expect(violationId("a", "b", "c/t", ViolationType.Upper, 0)).not.toBe(
      violationId("a/b", "c", "t", ViolationType.Upper, 0),
    );
  });

  it("commits nothing for a drag a listener cancels while a stalled commit refreshes", () => {
    vi.useFakeTimers();
    try {
      const store = createCorpusStore();
      const { row, trackId, point } = leafWithKey(store);
      const before = store.getState().tracks[trackId].points.map((p) => p.stamp);
      const frame = getMarkerFrame(store, row.id, point.id);
      store.getState().clickMarker(frame.points ?? [], row.id, frame.id, false, false);
      store.getState().startDrag({ axis: "horizontal", markerId: frame.id, rowId: row.id });
      stallBuilding(store);
      store.getState().updateDrag({ normalizedStamp: { current: 0.6 }, modifiers: {} as never });
      let cancelled = false;
      const unsubscribe = store.subscribe(
        (s) => s.derivedSnapshot,
        () => {
          if (cancelled) return;
          cancelled = true;
          store.getState().cancelDrag();
        },
      );
      store.getState().commitDrag();
      unsubscribe();
      expect(cancelled).toBe(true);
      expect(store.getState().tracks[trackId].points.map((p) => p.stamp)).toEqual(before);
    } finally {
      vi.useRealTimers();
    }
  });

  describe("an action reading the snapshot while stalled sees a key moved in the meantime", () => {
    /** Moves a leaf's first key halfway to its second, with building stalled or not. */
    const movedKey = (stall: boolean) => {
      const store = createCorpusStore();
      const { row, trackId } = leafWithKey(store);
      const [first, second] = store.getState().tracks[trackId].points;
      if (stall) stallBuilding(store);
      store.getState().updateKeypoint(trackId, {
        id: first.id,
        stamp: Math.round((first.stamp + second.stamp) / 2),
      });
      return { store, sourceRow: store.getState().instancedTrackSources[row.id] };
    };
    const player = (store: Store) => store.getState().playerStore.getState();
    /** Every stamp skipping visits from one end of the clip in one direction. */
    const skipAll = (stall: boolean, direction: "next" | "prev") => {
      const { store, sourceRow } = movedKey(stall);
      player(store).resetPlayer(direction === "next" ? -1e9 : 1e9);
      const visited: number[] = [];
      for (let i = 0; i < 20; i += 1) {
        if (direction === "next") store.getState().skipToNextKeyframe(sourceRow);
        else store.getState().skipToPrevKeyframe(sourceRow);
        const stamp = player(store).player.stamp;
        if (visited[visited.length - 1] === stamp) break;
        visited.push(stamp);
      }
      return visited;
    };

    it("when skipping to the next key", () => {
      vi.useFakeTimers();
      try {
        expect(skipAll(true, "next")).toEqual(skipAll(false, "next"));
      } finally {
        vi.useRealTimers();
      }
    });

    it("when skipping to the previous key", () => {
      vi.useFakeTimers();
      try {
        expect(skipAll(true, "prev")).toEqual(skipAll(false, "prev"));
      } finally {
        vi.useRealTimers();
      }
    });

    it("when box-selecting around it", () => {
      vi.useFakeTimers();
      try {
        // Where the moved key lands, in world time: the stamp a skip through
        // the moved clip visits that one through the unmoved clip does not.
        const unmoved = createCorpusStore();
        const unmovedRow = unmoved.getState().instancedTrackSources[leafWithKey(unmoved).row.id];
        player(unmoved).resetPlayer(-1e9);
        const unmovedStamps = new Set<number>();
        for (let i = 0; i < 20; i += 1) {
          unmoved.getState().skipToNextKeyframe(unmovedRow);
          unmovedStamps.add(player(unmoved).player.stamp);
        }
        const landed = skipAll(false, "next").find((stamp) => !unmovedStamps.has(stamp))!;
        expect(landed).toBeDefined();

        const select = (stall: boolean) => {
          const { store } = movedKey(stall);
          const viewId = Object.keys(store.getState().editorViews)[0];
          store.getState().startBoxSelect({
            origin: "timeline",
            startStamp: landed - 1,
            startY: 0,
            currentStamp: landed - 1,
            currentY: 0,
            mode: "replace",
            initialKeypoints: new Map(),
            layout: {
              viewId,
              canvasHeight: 100,
              topOffsetPx: 0,
              bottomOffsetPx: 100,
              trackHeightPx: 20,
            },
          });
          store.getState().updateBoxSelect(landed + 1, 100);
          return [...store.getState().selectionState.keypoints].map(([trackId, ids]) => [
            trackId,
            [...ids].sort(),
          ]);
        };
        const control = select(false);
        expect(control.length).toBeGreaterThan(0);
        expect(select(true)).toEqual(control);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  it("deletes nothing a listener makes read-only while a stalled delete refreshes", () => {
    vi.useFakeTimers();
    try {
      const store = createCorpusStore();
      const { row, trackId, point } = leafWithKey(store);
      const frame = getMarkerFrame(store, row.id, point.id);
      store.getState().clickMarker(frame.points ?? [], row.id, frame.id, false, false);
      expect(store.getState().selectionState.keypoints.get(trackId)?.has(point.id)).toBe(true);
      stallBuilding(store);
      let locked = false;
      const unsubscribe = store.subscribe(
        (s) => s.derivedSnapshot,
        () => {
          if (locked) return;
          locked = true;
          store.getState().setSourcesReadonly(row.id, true);
        },
      );
      // The selection changes no input but the snapshot trails it, so the
      // delete's refresh builds, and its listener runs before the delete
      // reads what may be edited.
      store.setState({ editorViews: { ...store.getState().editorViews } });
      store.getState().deleteSelection();
      unsubscribe();
      expect(locked).toBe(true);
      expect(store.getState().tracks[trackId].points.some((p) => p.id === point.id)).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps a filtered twin's object when a write leaves its content unchanged", () => {
    const store = createCorpusStore();
    const viewId = Object.keys(store.getState().editorViews)[0];
    const twins = () =>
      Object.entries(store.getState().instancedTrackSources).filter(([id]) =>
        isFilteredSourceRowId(id),
      );
    // A filter that leaves part of several groups visible makes several twins.
    const names = Object.values(store.getState().tracks).map((track) => track.id.slice(-3));
    const query = names.find((name) => {
      const { editorViews } = store.getState();
      store.setState({
        editorViews: { ...editorViews, [viewId]: { ...editorViews[viewId], trackFilter: name } },
      });
      return twins().length >= 2;
    });
    expect(query).toBeDefined();
    const before = Object.fromEntries(twins());
    // A click changes the source rows of the clicked track's rows only.
    const { row, point } = leafWithKey(store);
    const frame = getMarkerFrame(store, row.id, point.id);
    store.getState().clickMarker(frame.points ?? [], row.id, frame.id, false, false);
    let kept = 0;
    twins().forEach(([id, twin]) => {
      if (!before[id] || !isEqual(before[id], twin)) return;
      expect(twin, id).toBe(before[id]);
      kept += 1;
    });
    expect(kept).toBeGreaterThan(0);
  });

  it("does not answer one instance from another's cache when their ids differ only by a slash", () => {
    const store = createCorpusStore();
    const { trackId } = leafWithKey(store);
    const { tracks, animatables, trackEvaluator } = store.getState();
    const subject = (namespaceId: string, instanceId: string): FeedbackSubject => ({
      trackKey: `${namespaceId}/${instanceId}/${trackId}` as TrackKey,
      trackId,
      namespaceId,
      instanceId,
      track: tracks[trackId],
      animatable: animatables[tracks[trackId].animatableId],
      durationMs: 6000,
      timescale: 1,
    });
    const provider = createTrackFeedbackProvider();
    const first = provider.canonical([subject("a/b", "c")], trackEvaluator);
    const second = provider.canonical([subject("a", "b/c")], trackEvaluator);
    expect(second.get(`a/b/c/${trackId}` as TrackKey)).not.toBe(
      first.get(`a/b/c/${trackId}` as TrackKey),
    );
  });

  it("stops the subscriptions it is starting when their first build stops the store", () => {
    const store = createCorpusStore();
    let armed = false;
    const asked = vi.fn();
    store.setState({
      feedbackProvider: {
        canonical: (subjects, evaluator) => {
          asked();
          if (armed) {
            armed = false;
            store.getState().stopAnimationSubscriptions();
          }
          return judged(subjects, evaluator);
        },
        preview: (subject, evaluator) => computeSubjectViolations(subject, evaluator),
      },
    });
    armed = true;
    store.getState().initAnimationSubscriptions();
    asked.mockClear();
    const sources = store.getState().instancedTrackSources;
    const { trackId, point } = leafWithKey(store);
    store.getState().updateKeypoint(trackId, { id: point.id, value: 0.7 });
    store.setState({ tracks: { ...store.getState().tracks } });
    expect(asked).not.toHaveBeenCalled();
    expect(store.getState().instancedTrackSources).toBe(sources);
  });

  it("releases a provider's listener when the answer it gives from subscribe stops the store", () => {
    const store = createCorpusStore();
    const listeners = new Set<() => void>();
    store.subscribe(
      (s) => s.derivedSnapshot,
      () => store.getState().stopAnimationSubscriptions(),
    );
    store.setState({
      feedbackProvider: {
        canonical: judged,
        preview: (subject, evaluator) => computeSubjectViolations(subject, evaluator),
        subscribe: (listener) => {
          listeners.add(listener);
          listener();
          return () => listeners.delete(listener);
        },
      },
    });
    expect(listeners.size).toBe(0);
  });

  it("ignores a replaced provider that keeps calling the listener it was given", () => {
    const store = createCorpusStore();
    let stale = () => {};
    store.setState({
      feedbackProvider: {
        canonical: judged,
        preview: (subject, evaluator) => computeSubjectViolations(subject, evaluator),
        // Never forgets its listener, even when told to.
        subscribe: (listener) => {
          stale = listener;
          return () => {};
        },
      },
    });
    store.setState({ feedbackProvider: createTrackFeedbackProvider() });
    const version = store.getState().derivedSnapshot!.version;
    stale();
    expect(store.getState().derivedSnapshot!.version).toBe(version);
  });

  it.each([1, 8])(
    "commits nothing for a drag cancelled on publish %i of a refresh that never settles",
    (cancelOn) => {
      vi.useFakeTimers();
      try {
        const store = createCorpusStore();
        const { row, trackId, point } = leafWithKey(store);
        const before = store.getState().tracks[trackId].points.map((p) => p.stamp);
        const frame = getMarkerFrame(store, row.id, point.id);
        store.getState().clickMarker(frame.points ?? [], row.id, frame.id, false, false);
        store.getState().startDrag({ axis: "horizontal", markerId: frame.id, rowId: row.id });
        stallBuilding(store);
        store.getState().updateDrag({ normalizedStamp: { current: 0.6 }, modifiers: {} as never });
        let publishes = 0;
        const unsubscribe = store.subscribe(
          (s) => s.derivedSnapshot,
          () => {
            publishes += 1;
            if (publishes === cancelOn) store.getState().cancelDrag();
            store.setState({ editorViews: { ...store.getState().editorViews } });
          },
        );
        store.getState().commitDrag();
        unsubscribe();
        expect(publishes).toBeGreaterThanOrEqual(cancelOn);
        expect(store.getState().tracks[trackId].points.map((p) => p.stamp)).toEqual(before);
      } finally {
        vi.useRealTimers();
      }
    },
  );

  it("commits a drag where it was moved when a host listener commits it mid-write while stalled", () => {
    vi.useFakeTimers();
    try {
      const run = (stall: boolean) => {
        const store = createCorpusStore();
        const { row, trackId, point } = leafWithKey(store);
        const frame = getMarkerFrame(store, row.id, point.id);
        store.getState().clickMarker(frame.points ?? [], row.id, frame.id, false, false);
        store.getState().startDrag({ axis: "horizontal", markerId: frame.id, rowId: row.id });
        store.getState().updateDrag({ normalizedStamp: { current: 0.4 }, modifiers: {} as never });
        if (stall) stallBuilding(store);
        store.getState().updateDrag({ normalizedStamp: { current: 0.6 }, modifiers: {} as never });
        // Removing another track makes the store's subscriptions answer with
        // writes of their own; the host listener commits in the middle.
        let committed = false;
        const unsubscribe = store.subscribe(
          (s) => s.tracks,
          () => {
            if (committed) return;
            committed = true;
            store.getState().commitDrag();
          },
        );
        const other = Object.keys(store.getState().tracks).find((id) => id !== trackId)!;
        const { [other]: _removed, ...rest } = store.getState().tracks;
        store.setState({ tracks: rest });
        unsubscribe();
        expect(committed).toBe(true);
        return store.getState().tracks[trackId].points.map((p) => p.stamp);
      };
      expect(run(true)).toEqual(run(false));
    } finally {
      vi.useRealTimers();
    }
  });

  it("releases every listener of a provider replaced and set again while it is subscribing", () => {
    const store = createCorpusStore();
    const listeners = new Set<() => void>();
    let answered = false;
    const provider: FeedbackProvider = {
      canonical: judged,
      preview: (subject, evaluator) => computeSubjectViolations(subject, evaluator),
      subscribe: (listener) => {
        listeners.add(listener);
        // Answers once, from inside its first subscribe.
        if (!answered) {
          answered = true;
          first = listener;
          listener();
        }
        return () => listeners.delete(listener);
      },
    };
    let first = () => {};
    let swapped = false;
    const unsubscribe = store.subscribe(
      (s) => s.derivedSnapshot,
      () => {
        if (!answered || swapped) return;
        swapped = true;
        store.setState({ feedbackProvider: createTrackFeedbackProvider() });
        store.setState({ feedbackProvider: provider });
      },
    );
    store.setState({ feedbackProvider: provider });
    unsubscribe();
    expect(swapped).toBe(true);
    // The first watch's listener ended with it, though the provider is set again.
    const version = store.getState().derivedSnapshot!.version;
    first();
    expect(store.getState().derivedSnapshot!.version).toBe(version);
    store.getState().stopAnimationSubscriptions();
    expect(listeners.size).toBe(0);
  });

  it("keeps a set started while the previous one stops current: it refreshes and it stops", () => {
    vi.useFakeTimers();
    try {
      const store = createCorpusStore();
      let restartOnRelease = false;
      store.setState({
        feedbackProvider: {
          canonical: judged,
          preview: (subject, evaluator) => computeSubjectViolations(subject, evaluator),
          // Starts the store's subscriptions again while the old set releases it.
          subscribe: () => () => {
            if (!restartOnRelease) return;
            restartOnRelease = false;
            store.getState().initAnimationSubscriptions();
          },
        },
      });
      restartOnRelease = true;
      store.getState().stopAnimationSubscriptions();
      expect(restartOnRelease).toBe(false);

      // The new set refreshes a stalled snapshot for an action.
      stallBuilding(store);
      const version = store.getState().derivedSnapshot!.version!;
      store.getState().setEmphasis(null);
      expect(store.getState().derivedSnapshot!.version!).toBeGreaterThan(version);

      // And it is the one `stopAnimationSubscriptions` stops.
      store.getState().stopAnimationSubscriptions();
      vi.runAllTimers();
      const stopped = store.getState().derivedSnapshot!.version;
      const { trackId, point } = leafWithKey(store);
      store.getState().updateKeypoint(trackId, { id: point.id, value: 0.9 });
      expect(store.getState().derivedSnapshot!.version).toBe(stopped);
    } finally {
      vi.useRealTimers();
    }
  });

  it("refreshes once for a provider that changes on every ask, when the inputs did not", () => {
    vi.useFakeTimers();
    try {
      const store = createCorpusStore();
      const listeners = new Set<() => void>();
      store.setState({
        feedbackProvider: {
          canonical: (subjects, evaluator) => {
            listeners.forEach((listener) => listener());
            return judged(subjects, evaluator);
          },
          preview: (subject, evaluator) => computeSubjectViolations(subject, evaluator),
          subscribe: (listener) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
          },
        },
      });
      expect(vi.getTimerCount()).toBe(1);
      const version = store.getState().derivedSnapshot!.version!;
      store.getState().setEmphasis(null);
      expect(store.getState().derivedSnapshot!.version! - version).toBe(1);
      store.getState().stopAnimationSubscriptions();
    } finally {
      vi.useRealTimers();
    }
  });

  it("answers an action with the published snapshot when it is current, and builds one when it trails", () => {
    vi.useFakeTimers();
    try {
      const store = createCorpusStore();
      expect(currentDerivedSnapshot(store.getState())).toBe(store.getState().derivedSnapshot);
      stallBuilding(store);
      const { trackId, point } = leafWithKey(store);
      store.setState({
        tracks: {
          ...store.getState().tracks,
          [trackId]: {
            ...store.getState().tracks[trackId],
            points: store
              .getState()
              .tracks[trackId].points.map((p) => (p.id === point.id ? { ...p, value: 0.77 } : p)),
          },
        },
      });
      const published = store.getState().derivedSnapshot;
      const current = currentDerivedSnapshot(store.getState());
      expect(current).not.toBe(published);
      expect(store.getState().derivedSnapshot).toBe(published);
      expect(normalize(current)).toEqual(
        normalize(computeDerivedState(selectDerivedInputs(store.getState()), 0)),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  describe("a stalled action's refresh leaves the published snapshot current", () => {
    it("when a write the provider makes drops the build it forced", () => {
      vi.useFakeTimers();
      try {
        const store = createCorpusStore();
        let armed = false;
        store.setState({
          feedbackProvider: {
            canonical: (subjects, evaluator) => {
              if (armed) {
                armed = false;
                bumpKey(store);
              }
              return judged(subjects, evaluator);
            },
            preview: (subject, evaluator) => computeSubjectViolations(subject, evaluator),
          },
        });
        stallBuilding(store);
        armed = true;
        store.getState().setEmphasis(null);
        expect(armed).toBe(false);
        expect(isCurrent(store)).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });

    it("when a listener answers its publish with a write", () => {
      vi.useFakeTimers();
      try {
        const store = createCorpusStore();
        stallBuilding(store);
        let answered = false;
        const unsubscribe = store.subscribe(
          (s) => s.derivedSnapshot,
          () => {
            if (answered) return;
            answered = true;
            bumpKey(store);
          },
        );
        store.getState().setEmphasis(null);
        unsubscribe();
        expect(answered).toBe(true);
        expect(isCurrent(store)).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  it("publishes nothing built mid-write for an action a player listener takes while stalled", () => {
    vi.useFakeTimers();
    try {
      const store = createCorpusStore();
      stallBuilding(store);
      const { row, trackId } = leafWithKey(store);
      let acted = 0;
      const stopPlayer = store.getState().playerStore.subscribe(() => {
        acted += 1;
        store.getState().setEmphasis(null);
      });
      const published: string[][] = [];
      const unsubscribe = store.subscribe(
        (s) => s.derivedSnapshot,
        (snapshot) => published.push(Object.keys(snapshot!.rows)),
      );
      // The store's subscriptions answer a removed track with writes of their
      // own; the overall duration's notifies the player before the source
      // rows have caught up.
      const { [trackId]: _removed, ...rest } = store.getState().tracks;
      store.setState({ tracks: rest });
      stopPlayer();
      unsubscribe();
      expect(acted).toBeGreaterThan(0);
      published.forEach((rowIds) => expect(rowIds).not.toContain(row.id));
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not ask the host's provider for the snapshot an action builds when the published one trails", () => {
    vi.useFakeTimers();
    try {
      const store = createCorpusStore();
      const asked = vi.fn(judged);
      store.setState({
        feedbackProvider: {
          canonical: asked,
          preview: (subject, evaluator) => computeSubjectViolations(subject, evaluator),
        },
      });
      stallBuilding(store);
      bumpKey(store);
      asked.mockClear();
      const current = currentDerivedSnapshot(store.getState());
      expect(current).not.toBe(store.getState().derivedSnapshot);
      expect(asked).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("hands each subject the curve the build compiled, and the editor's checks use it", () => {
    const store = createCorpusStore();
    const seen: FeedbackSubject[] = [];
    store.setState({
      feedbackProvider: {
        canonical: (subjects, evaluator) => {
          seen.push(...subjects);
          return judged(subjects, evaluator);
        },
        preview: (subject, evaluator) => computeSubjectViolations(subject, evaluator),
      },
    });
    const { tracks } = store.getState().derivedSnapshot!;
    const withCurve = seen.filter((subject) => subject.curve);
    expect(withCurve.length).toBeGreaterThan(0);
    withCurve.forEach((subject) =>
      expect(subject.curve).toBe(tracks[subject.trackKey].canonical.curve),
    );
    // Without an evaluator nothing compiles, so only the handed curve can be judged.
    const judgedSubject = withCurve.find(
      (subject) => tracks[subject.trackKey].canonical.violations.length > 0,
    )!;
    expect(computeSubjectViolations(judgedSubject, undefined)).toEqual(
      tracks[judgedSubject.trackKey].canonical.violations,
    );
  });

  it("judges two instances' previews apart when their ids differ only by where a slash falls", () => {
    const store = createCorpusStore();
    const { trackId } = leafWithKey(store);
    const { tracks, animatables, trackEvaluator } = store.getState();
    const subject = (namespaceId: string, instanceId: string): FeedbackSubject => ({
      trackKey: `${namespaceId}/${instanceId}/${trackId}` as TrackKey,
      trackId,
      namespaceId,
      instanceId,
      track: tracks[trackId],
      animatable: animatables[tracks[trackId].animatableId],
      durationMs: 6000,
      timescale: 1,
    });
    const preview = vi.fn((s: FeedbackSubject) => [
      { id: s.namespaceId, namespace: s.namespaceId, instanceId: s.instanceId } as Violation,
    ]);
    const shared = sharedPreviewViolations({ canonical: judged, preview }, trackEvaluator);
    expect(shared(subject("a/b", "c"))[0].namespace).toBe("a/b");
    expect(shared(subject("a", "b/c"))[0].namespace).toBe("a");
    expect(preview).toHaveBeenCalledTimes(2);
  });

  it("does not ask a provider whose subscribe stopped the store or set another", () => {
    const store = createCorpusStore();
    const stopping = vi.fn(judged);
    store.setState({
      feedbackProvider: {
        canonical: stopping,
        preview: (subject, evaluator) => computeSubjectViolations(subject, evaluator),
        subscribe: () => {
          store.getState().stopAnimationSubscriptions();
          return () => {};
        },
      },
    });
    expect(stopping).not.toHaveBeenCalled();

    const other = createCorpusStore();
    const replaced = vi.fn(judged);
    other.setState({
      feedbackProvider: {
        canonical: replaced,
        preview: (subject, evaluator) => computeSubjectViolations(subject, evaluator),
        subscribe: () => {
          other.setState({ feedbackProvider: createTrackFeedbackProvider() });
          return () => {};
        },
      },
    });
    expect(replaced).not.toHaveBeenCalled();
    expect(isCurrent(other)).toBe(true);
  });

  it("stops a standalone orchestrator whose first build throws", () => {
    const store = createCorpusStore();
    store.getState().stopAnimationSubscriptions();
    const failing = vi.fn(() => {
      throw new Error("provider failed");
    });
    store.setState({ feedbackProvider: { canonical: failing, preview: () => [] } });
    expect(() =>
      initDerivedOrchestrator(store as never, store.setState as never, store.getState),
    ).toThrow("provider failed");
    failing.mockClear();
    bumpKey(store);
    expect(failing).not.toHaveBeenCalled();
  });

  it("runs its own subscriptions before a host listener subscribed between two starts", () => {
    const store = createCorpusStore();
    const { trackId, point } = leafWithKey(store);
    const seen: (number | undefined)[] = [];
    const unsubscribe = store.subscribe(
      (s) => s.tracks,
      () => seen.push(store.getState().derivedSnapshot?.version),
    );
    store.getState().initAnimationSubscriptions();
    store.getState().updateKeypoint(trackId, { id: point.id, value: 0.321 });
    unsubscribe();
    expect(seen).toEqual([store.getState().derivedSnapshot!.version]);
    expect(isCurrent(store)).toBe(true);
  });

  it("leaves no subscription running when the first build throws", () => {
    const store = createCorpusStore();
    const failing: FeedbackProvider = {
      canonical: () => {
        throw new Error("provider failed");
      },
      preview: () => [],
    };
    expect(() => store.setState({ feedbackProvider: failing })).toThrow("provider failed");
    expect(() => store.getState().initAnimationSubscriptions()).toThrow("provider failed");
    const asked = vi.fn(judged);
    const version = store.getState().derivedSnapshot?.version;
    const sources = store.getState().instancedTrackSources;
    store.setState({
      feedbackProvider: {
        canonical: asked,
        preview: (subject, evaluator) => computeSubjectViolations(subject, evaluator),
      },
    });
    const { trackId, point } = leafWithKey(store);
    store.getState().updateKeypoint(trackId, { id: point.id, value: 0.2 });
    expect(asked).not.toHaveBeenCalled();
    expect(store.getState().derivedSnapshot?.version).toBe(version);
    expect(store.getState().instancedTrackSources).toBe(sources);
  });

  it("shows a provider's preview violations in the track preview when no curve compiles", () => {
    const store = createCorpusStore();
    const flagged = (subject: FeedbackSubject): Violation[] => [
      {
        id: `preview:${subject.trackKey}`,
        trackId: subject.trackId,
        namespace: subject.namespaceId,
        instanceId: subject.instanceId,
        type: "upper",
        stampRange: { start: 0, end: 1 },
      } as Violation,
    ];
    store.setState({
      trackEvaluator: undefined,
      feedbackProvider: { canonical: judged, preview: flagged },
    });
    const { row, point } = leafWithKey(store);
    const frame = getMarkerFrame(store, row.id, point.id);
    store.getState().clickMarker(frame.points ?? [], row.id, frame.id, false, false);
    store.getState().startDrag({ axis: "horizontal", markerId: frame.id, rowId: row.id });
    store.getState().updateDrag({ normalizedStamp: { current: 0.5 }, modifiers: {} as never });
    const previews = Object.values(store.getState().derivedSnapshot!.tracks).filter(
      (track) => track.preview,
    );
    expect(previews.length).toBeGreaterThan(0);
    previews.forEach((track) => expect(track.preview?.violations).toHaveLength(1));
    store.getState().cancelDrag();
  });

  describe("a feedback provider in the store's state", () => {
    const keepWorking = (provider: FeedbackProvider) => {
      const store = createCorpusStore();
      store.setState({ feedbackProvider: provider });
      const { trackId, point } = leafWithKey(store);
      [0.1, 0.2, 0.3].forEach((value) =>
        store.getState().updateKeypoint(trackId, { id: point.id, value }),
      );
      expect(isCurrent(store)).toBe(true);
    };

    it("keeps working with its state in its closure", () => {
      keepWorking(createTrackFeedbackProvider());
    });

    it("keeps working with its state in a class instance's fields", () => {
      class CachingProvider implements FeedbackProvider {
        cache = new Map<TrackKey, Violation[]>();
        canonical(subjects: readonly FeedbackSubject[], evaluator: unknown) {
          const result = judged(subjects, evaluator);
          result.forEach((violations, key) => this.cache.set(key, violations));
          return result;
        }
        preview(subject: FeedbackSubject, evaluator: unknown) {
          return computeSubjectViolations(subject, evaluator as never);
        }
      }
      keepWorking(new CachingProvider());
    });

    it("throws with its state in a plain object's properties", () => {
      const provider = {
        cache: new Map<TrackKey, Violation[]>(),
        canonical(subjects: readonly FeedbackSubject[], evaluator: unknown) {
          const result = judged(subjects, evaluator);
          result.forEach((violations, key) => provider.cache.set(key, violations));
          return result;
        },
        preview: (subject: FeedbackSubject, evaluator: unknown) =>
          computeSubjectViolations(subject, evaluator as never),
      };
      expect(() => keepWorking(provider as FeedbackProvider)).toThrow();
    });
  });

  it("forgets the default provider's results for a subject no build asks for", () => {
    const store = createCorpusStore();
    const { trackEvaluator } = store.getState();
    const { tracks, animatables } = store.getState();
    const subjects: FeedbackSubject[] = Object.entries(store.getState().derivedSnapshot!.tracks)
      .slice(0, 2)
      .map(([trackKey, { metadata }]) => ({
        trackKey: trackKey as TrackKey,
        trackId: metadata!.trackId!,
        namespaceId: metadata!.namespaceId!,
        instanceId: metadata!.instanceId!,
        track: tracks[metadata!.trackId!],
        animatable: animatables[metadata!.animatableId],
        durationMs: metadata!.duration,
        timescale: metadata!.timescale,
      }));
    const [a, b] = subjects;
    const provider = createTrackFeedbackProvider();
    const first = provider.canonical([a, b], trackEvaluator);
    const without = provider.canonical([a], trackEvaluator);
    const again = provider.canonical([a, b], trackEvaluator);
    expect(without.get(a.trackKey)).toBe(first.get(a.trackKey));
    expect(again.get(a.trackKey)).toBe(first.get(a.trackKey));
    expect(again.get(b.trackKey)).not.toBe(first.get(b.trackKey));
    expect(again.get(b.trackKey)).toEqual(first.get(b.trackKey));
  });
});
