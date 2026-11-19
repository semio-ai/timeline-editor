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
import { ViolationType, type DerivedSnapshot, type TrackKey, type Violation } from "../../types";
import { violationId } from "../../functions/compute-track-violations";
import { isFilteredSourceRowId } from "../../functions/view-filtered-source-row";
import { getMarkerFrame } from "../selection/selection-test-helpers";
import { buildTrackKey } from "../../utils/track-key";
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

  it("publishes nothing for an action while stalled, so no listener runs inside it", () => {
    vi.useFakeTimers();
    try {
      const store = createCorpusStore();
      stallBuilding(store);
      bumpKey(store);
      let published = 0;
      const unsubscribe = store.subscribe(
        (s) => s.derivedSnapshot,
        () => {
          published += 1;
        },
      );
      const { row, point } = leafWithKey(store);
      const frame = getMarkerFrame(store, row.id, point.id);
      store.getState().clickMarker(frame.points ?? [], row.id, frame.id, false, false);
      unsubscribe();
      expect(published).toBe(0);
      expect(store.getState().selectionState.keypoints.size).toBeGreaterThan(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows a late answer from a provider set while building was stalled", () => {
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

  describe("an action while stalled reads the derived data of the state as it now is", () => {
    /**
     * Runs `act` after `edit`, once with building stalled across the edit and
     * once without, and returns both results.
     */
    const bothWays = <T>(edit: (store: Store) => void, act: (store: Store) => T) => {
      vi.useFakeTimers();
      try {
        return [true, false].map((stall) => {
          const store = createCorpusStore();
          if (stall) stallBuilding(store);
          edit(store);
          return act(store);
        });
      } finally {
        vi.useRealTimers();
      }
    };
    /** Adds a key halfway between the leaf's first two. */
    const addKey = (store: Store) => {
      const { trackId } = leafWithKey(store);
      const track = store.getState().tracks[trackId];
      const [first, second] = track.points;
      const added = {
        ...first,
        id: "added-key",
        stamp: Math.round((first.stamp + second.stamp) / 2),
      };
      store.setState({
        tracks: {
          ...store.getState().tracks,
          [trackId]: { ...track, points: [first, added, ...track.points.slice(1)] },
        },
      });
    };
    const selected = (store: Store) =>
      [...store.getState().selectionState.keypoints].map(([trackId, ids]) => [
        trackId,
        [...ids].sort(),
      ]);
    /** The selection frame holding a key, as the snapshot for the current state has it. */
    const frameOf = (store: Store, rowId: string, keyId: string) =>
      currentDerivedSnapshot(store.getState())!.rows[rowId].computed.selection!.find((frame) =>
        frame.points?.some((p) => p.markerId === keyId),
      )!;

    it("when selecting a row's keys by clicking its line", () => {
      const [stalled, control] = bothWays(addKey, (store) => {
        store.getState().clickLine(leafWithKey(store).row.id, "line");
        return selected(store);
      });
      expect(JSON.stringify(control)).toContain("added-key");
      expect(stalled).toEqual(control);
    });

    it("when shift-clicking a range", () => {
      const [stalled, control] = bothWays(
        (store) => {
          const { row, point } = leafWithKey(store);
          const frame = getMarkerFrame(store, row.id, point.id);
          store.getState().clickMarker(frame.points ?? [], row.id, frame.id, false, false);
          addKey(store);
        },
        (store) => {
          const { row, trackId } = leafWithKey(store);
          const last = store.getState().tracks[trackId].points.at(-1)!;
          const frame = frameOf(store, row.id, last.id);
          store.getState().clickMarker(frame.points ?? [], row.id, frame.id, true, false);
          return selected(store);
        },
      );
      expect(JSON.stringify(control)).toContain("added-key");
      expect(stalled).toEqual(control);
    });

    it("when starting a drag on a key added meanwhile", () => {
      const [stalled, control] = bothWays(addKey, (store) => {
        const { row } = leafWithKey(store);
        const frame = frameOf(store, row.id, "added-key");
        store.getState().clickMarker(frame.points ?? [], row.id, frame.id, false, false);
        store.getState().startDrag({ axis: "horizontal", markerId: frame.id, rowId: row.id });
        return store.getState().dragState?.anchor;
      });
      expect(control).toBeDefined();
      expect(stalled).toEqual(control);
    });

    it.each([undefined, { domain: [1, 1] as [number, number], clamp: true }])(
      "when dragging a value in a row whose range grew, with scale %o",
      (valueScale) => {
        const [stalled, control] = bothWays(
          (store) => {
            // A row's range is its animatable's limits.
            const { trackId } = leafWithKey(store);
            const { animatableId } = store.getState().tracks[trackId];
            const animatable = store.getState().animatables[animatableId];
            store.setState({
              animatables: {
                ...store.getState().animatables,
                [animatableId]: {
                  ...animatable,
                  constraints: {
                    ...(animatable as { constraints?: object }).constraints,
                    min: -500,
                    max: 500,
                  },
                } as typeof animatable,
              },
            });
          },
          (store) => {
            const { row, trackId, point } = leafWithKey(store);
            const datum = row.data[0];
            const value = store.getState().tracks[trackId].points.find((p) => p.id === point.id)!
              .value as number;
            store.getState().startValueDrag({
              rowId: row.id,
              trackId,
              namespaceId: datum.namespaceId,
              instanceId: datum.instanceId,
              worldStamp: point.stamp,
              // Without a range of its own, the drag measures by the row's.
              valueScale,
            });
            store.getState().updateValueDrag({
              currentValue: value + 1,
              modifiers: { alt: false, shift: false, meta: false },
            });
            const drag = store.getState().dragState;
            return drag && { scale: drag.anchor.valueScale, delta: drag.normalizedValueDelta };
          },
        );
        expect(control).toBeDefined();
        expect(stalled).toEqual(control);
      },
    );
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

  it("keeps a set started while the previous one stops current, so it is the one a stop stops", () => {
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
      // The set the release started is running.
      const running = store.getState().derivedSnapshot!.version!;
      bumpKey(store);
      expect(store.getState().derivedSnapshot!.version!).toBeGreaterThan(running);

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
      // Asked again for the same inputs, it does not build again.
      expect(currentDerivedSnapshot(store.getState())).toBe(current);
      expect(normalize(current)).toEqual(
        normalize(computeDerivedState(selectDerivedInputs(store.getState()), 0)),
      );
    } finally {
      vi.useRealTimers();
    }
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

  it("skips to where a key is now when a player listener skips mid-write", () => {
    const store = createCorpusStore();
    const { row, trackId } = leafWithKey(store);
    const sourceRow = store.getState().instancedTrackSources[row.id];
    const player = () => store.getState().playerStore.getState();
    let landed: number | undefined;
    let skipping = false;
    const stopPlayer = store.getState().playerStore.subscribe(() => {
      // Moving the playhead notifies this listener again.
      if (skipping || landed !== undefined) return;
      skipping = true;
      player().resetPlayer(-1e9);
      store.getState().skipToNextKeyframe(sourceRow);
      landed = player().player.stamp;
    });
    // New keys far apart, the last past the clip's end, so the overall
    // duration changes and notifies the player before the rows catch up.
    const track = store.getState().tracks[trackId];
    const [first, second] = track.points;
    store.setState({
      tracks: {
        ...store.getState().tracks,
        [trackId]: {
          ...track,
          points: [
            { ...first, stamp: 1234 },
            { ...second, stamp: 98765 },
          ],
        },
      },
    });
    stopPlayer();
    expect(landed).toBeDefined();
    player().resetPlayer(-1e9);
    store.getState().skipToNextKeyframe(sourceRow);
    expect(landed).toBe(player().player.stamp);
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

  it("asks the provider about the most recently compiled tracks first", () => {
    const store = createCorpusStore();
    let asked: TrackKey[] = [];
    store.setState({
      feedbackProvider: {
        canonical: (subjects, evaluator) => {
          asked = subjects.map((subject) => subject.trackKey);
          return judged(subjects, evaluator);
        },
        preview: (subject, evaluator) => computeSubjectViolations(subject, evaluator),
      },
    });
    // The snapshot's tracks are in the order the build compiled them.
    const compiled = Object.keys(store.getState().derivedSnapshot!.tracks);
    expect(asked.length).toBeGreaterThan(1);
    expect(asked).toEqual([...compiled].reverse());
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

  it("releases what a standalone orchestrator subscribed when its first build throws", () => {
    const store = createCorpusStore();
    store.getState().stopAnimationSubscriptions();
    const watching = new Set<() => void>();
    store.setState({
      feedbackProvider: {
        canonical: () => {
          throw new Error("provider failed");
        },
        preview: () => [],
        subscribe: (listener) => {
          watching.add(listener);
          return () => watching.delete(listener);
        },
      },
    });
    // The store's API, counting the listeners subscribed through it.
    let subscribed = 0;
    const api = {
      ...store,
      subscribe: (listener: Parameters<typeof store.subscribe>[0]) => {
        subscribed += 1;
        const unsubscribe = store.subscribe(listener);
        return () => {
          subscribed -= 1;
          unsubscribe();
        };
      },
    };
    expect(() =>
      initDerivedOrchestrator(api as never, store.setState as never, store.getState),
    ).toThrow("provider failed");
    expect(subscribed).toBe(0);
    expect(watching.size).toBe(0);
  });

  it("builds again for an action when the state changed since the last one it built for", () => {
    vi.useFakeTimers();
    try {
      const store = createCorpusStore();
      stallBuilding(store);
      bumpKey(store);
      const first = currentDerivedSnapshot(store.getState());
      bumpKey(store);
      const second = currentDerivedSnapshot(store.getState());
      expect(second).not.toBe(first);
      expect(normalize(second)).toEqual(
        normalize(computeDerivedState(selectDerivedInputs(store.getState()), 0)),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("answers an action with the published snapshot when it is current, whatever provider is set", () => {
    const store = createCorpusStore();
    store.setState({
      feedbackProvider: {
        canonical: judged,
        preview: (subject, evaluator) => computeSubjectViolations(subject, evaluator),
      },
    });
    expect(currentDerivedSnapshot(store.getState())).toBe(store.getState().derivedSnapshot);
  });

  it("judges, for a track key two instances share, the one whose record the snapshot keeps", () => {
    const store = createCorpusStore();
    const [namespace] = Object.values(store.getState().namespaces);
    const [instance] = Object.values(namespace.animationInstances);
    // Two instances whose namespace and instance ids differ only in where a
    // "/" falls, so their tracks share track keys.
    const copy = (namespaceId: string, instanceId: string) => ({
      ...namespace,
      id: namespaceId,
      animationInstances: { [instanceId]: { ...instance, id: instanceId } },
    });
    store.setState({
      namespaces: {
        ...store.getState().namespaces,
        "a/b": copy("a/b", "c"),
        a: copy("a", "b/c"),
      },
    });
    const shared = Object.values(store.getState().derivedSnapshot!.tracks).filter(
      (track) => track.metadata?.namespaceId === "a" || track.metadata?.namespaceId === "a/b",
    );
    expect(shared.some((track) => track.canonical.violations.length > 0)).toBe(true);
    shared.forEach((track) =>
      track.canonical.violations.forEach((violation) => {
        expect(violation.namespace).toBe(track.metadata?.namespaceId);
        expect(violation.instanceId).toBe(track.metadata?.instanceId);
      }),
    );
  });

  it.each([
    ["the editor's own checks", undefined],
    ["the default provider", createTrackFeedbackProvider()],
  ])(
    "compiles again, past the curve cache's size, only the tracks beyond it, judged by %s",
    (_by, feedbackProvider) => {
      const state = createCorpusStore().getState();
      const { trackId } = leafWithKey(createCorpusStore());
      const base = state.tracks[trackId];
      const count = 520;
      const tracks = Object.fromEntries(
        Array.from({ length: count }, (_, i) => {
          const id = `copy-${i}`;
          const points = Object.freeze(
            base.points.map((p) => Object.freeze({ ...p, value: (p.value as number) + i * 0.001 })),
          );
          return [id, Object.freeze({ ...base, id, points })];
        }),
      );
      const animation = {
        ...Object.values(state.animations)[0],
        id: "copies",
        tracks: Object.keys(tracks),
      };
      const [namespace] = Object.values(state.namespaces);
      const [instance] = Object.values(namespace.animationInstances);
      let compiles = 0;
      const evaluator = {
        compile: (track: Parameters<NonNullable<typeof state.trackEvaluator>["compile"]>[0]) => {
          compiles += 1;
          return state.trackEvaluator!.compile(track);
        },
      };
      computeDerivedState(
        {
          ...selectDerivedInputs(state),
          tracks: { ...state.tracks, ...tracks } as typeof state.tracks,
          animations: { copies: animation } as typeof state.animations,
          namespaces: {
            [namespace.id]: {
              ...namespace,
              animationInstances: { [instance.id]: { ...instance, animationId: "copies" } },
            },
          } as typeof state.namespaces,
          instancedTrackSources: {},
          trackEvaluator: evaluator,
        },
        0,
        feedbackProvider,
      );
      expect(compiles).toBe(count + (count - 512));
    },
    30_000,
  );

  it("compiles again only past the curve cache, when instances sharing track keys visit their tracks in opposite orders", () => {
    const state = createCorpusStore().getState();
    const { trackId } = leafWithKey(createCorpusStore());
    const base = state.tracks[trackId];
    const count = 520;
    const tracks = Object.fromEntries(
      Array.from({ length: count }, (_, i) => {
        const id = `copy-${i}`;
        const points = Object.freeze(
          base.points.map((p) => Object.freeze({ ...p, value: (p.value as number) + i * 0.001 })),
        );
        return [id, Object.freeze({ ...base, id, points })];
      }),
    );
    const ids = Object.keys(tracks);
    const animation = Object.values(state.animations)[0];
    const [namespace] = Object.values(state.namespaces);
    const [instance] = Object.values(namespace.animationInstances);
    const playing = (namespaceId: string, instanceId: string, animationId: string) => ({
      ...namespace,
      id: namespaceId,
      animationInstances: { [instanceId]: { ...instance, id: instanceId, animationId } },
    });
    let compiles = 0;
    computeDerivedState(
      {
        ...selectDerivedInputs(state),
        tracks: { ...state.tracks, ...tracks } as typeof state.tracks,
        animations: {
          forward: { ...animation, id: "forward", tracks: ids },
          backward: { ...animation, id: "backward", tracks: [...ids].reverse() },
        } as typeof state.animations,
        // Their track keys collide: the later instance's subjects are judged.
        namespaces: {
          "a/b": playing("a/b", "c", "forward"),
          a: playing("a", "b/c", "backward"),
        } as typeof state.namespaces,
        instancedTrackSources: {},
        trackEvaluator: {
          compile: (track) => {
            compiles += 1;
            return state.trackEvaluator!.compile(track);
          },
        },
      },
      0,
    );
    // Judging the later instance in its own compile order would recompile
    // every track once more.
    expect(compiles).toBe(count + 2 * (count - 512));
  }, 30_000);

  it("answers a restart with the set a provider's release started during it", () => {
    vi.useFakeTimers();
    try {
      const store = createCorpusStore();
      let restartOnRelease = false;
      store.setState({
        feedbackProvider: {
          canonical: judged,
          preview: (subject, evaluator) => computeSubjectViolations(subject, evaluator),
          subscribe: () => () => {
            if (!restartOnRelease) return;
            restartOnRelease = false;
            store.getState().initAnimationSubscriptions();
          },
        },
      });
      restartOnRelease = true;
      // Releasing the provider while restarting starts a set of its own.
      store.getState().initAnimationSubscriptions();
      expect(restartOnRelease).toBe(false);
      // One set is running.
      const running = store.getState().derivedSnapshot!.version!;
      bumpKey(store);
      expect(store.getState().derivedSnapshot!.version! - running).toBe(1);
      store.getState().stopAnimationSubscriptions();
      vi.runAllTimers();
      const stopped = store.getState().derivedSnapshot!.version;
      bumpKey(store);
      expect(store.getState().derivedSnapshot!.version).toBe(stopped);
    } finally {
      vi.useRealTimers();
    }
  });

  it("releases a replaced provider once, though its release writes to the store", () => {
    const store = createCorpusStore();
    let releases = 0;
    const listeners = new Set<() => void>();
    store.setState({
      feedbackProvider: {
        canonical: judged,
        preview: (subject, evaluator) => computeSubjectViolations(subject, evaluator),
        subscribe: (listener) => {
          listeners.add(listener);
          return () => {
            releases += 1;
            listeners.delete(listener);
            // Its own code: writes to an input, and calls its listener.
            bumpKey(store);
            listener();
          };
        },
      },
    });
    const next = new Set<() => void>();
    store.setState({
      feedbackProvider: {
        canonical: judged,
        preview: (subject, evaluator) => computeSubjectViolations(subject, evaluator),
        subscribe: (listener) => {
          next.add(listener);
          return () => next.delete(listener);
        },
      },
    });
    expect(releases).toBe(1);
    expect(listeners.size).toBe(0);
    expect(next.size).toBe(1);
    expect(isCurrent(store)).toBe(true);
  });

  it("hands on, in an action's snapshot, the published rows an edit did not reach", () => {
    vi.useFakeTimers();
    try {
      const store = createCorpusStore();
      stallBuilding(store);
      const { trackId } = leafWithKey(store);
      bumpKey(store);
      const published = store.getState().derivedSnapshot!;
      const current = currentDerivedSnapshot(store.getState())!;
      const sources = store.getState().instancedTrackSources;
      let kept = 0;
      Object.keys(current.rows).forEach((rowId) => {
        const draws = sources[rowId]?.data.some((datum) => datum.trackId === trackId);
        if (draws) expect(current.rows[rowId], rowId).not.toBe(published.rows[rowId]);
        else if (current.rows[rowId] === published.rows[rowId]) kept += 1;
      });
      expect(kept).toBeGreaterThan(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("judges again, in an action's snapshot, a track an edit changed", () => {
    vi.useFakeTimers();
    try {
      const store = createCorpusStore();
      stallBuilding(store);
      const { row, trackId, point } = leafWithKey(store);
      const datum = row.data[0];
      const key = buildTrackKey(datum.namespaceId, datum.instanceId, trackId);
      // Far past the animatable's limits: the edit makes a violation.
      const track = store.getState().tracks[trackId];
      store.setState({
        tracks: {
          ...store.getState().tracks,
          [trackId]: {
            ...track,
            points: track.points.map((p) =>
              p.id === point.id ? { ...p, value: (p.value as number) + 1000 } : p,
            ),
          },
        },
      });
      const current = currentDerivedSnapshot(store.getState())!;
      const fresh = computeDerivedState(selectDerivedInputs(store.getState()), 0);
      const violations = current.tracks[key].canonical.violations;
      expect(violations).not.toBe(
        store.getState().derivedSnapshot!.tracks[key].canonical.violations,
      );
      expect(violations).toEqual(fresh.tracks[key].canonical.violations);
      expect(violations.length).toBeGreaterThan(0);
    } finally {
      vi.useRealTimers();
    }
  });

  describe("judges again, in an action's snapshot, the tracks an edit to what their checks read changed", () => {
    /** Every canonical violation by track, as content. */
    const violationsOf = (snapshot: DerivedSnapshot | undefined) =>
      Object.fromEntries(
        Object.entries(snapshot?.tracks ?? {}).map(([key, track]) => [
          key,
          track.canonical.violations.map((v) =>
            JSON.stringify([v.namespace, v.instanceId, v.trackId, v.type, v.stampRange]),
          ),
        ]),
      );
    const leafInstance = (store: Store) => {
      const { row } = leafWithKey(store);
      const { namespaceId, instanceId } = row.data[0];
      const namespace = store.getState().namespaces[namespaceId];
      return {
        namespaceId,
        instanceId,
        namespace,
        instance: namespace.animationInstances[instanceId],
      };
    };
    const edits: [string, (store: Store) => void][] = [
      [
        "the animatable's limits",
        (store) => {
          const { trackId } = leafWithKey(store);
          const { animatableId } = store.getState().tracks[trackId];
          const animatable = store.getState().animatables[animatableId] as {
            constraints?: object;
          };
          store.setState({
            animatables: {
              ...store.getState().animatables,
              [animatableId]: {
                ...animatable,
                constraints: { ...animatable.constraints, min: -0.001, max: 0.001 },
              } as never,
            },
          });
        },
      ],
      [
        "the instance's timescale",
        (store) => {
          const { namespaceId, namespace, instanceId, instance } = leafInstance(store);
          store.setState({
            namespaces: {
              ...store.getState().namespaces,
              [namespaceId]: {
                ...namespace,
                animationInstances: {
                  ...namespace.animationInstances,
                  [instanceId]: { ...instance, settings: { ...instance.settings, timescale: 40 } },
                },
              },
            },
          });
        },
      ],
      [
        "the animation's duration",
        (store) => {
          // Violations are sampled across the animation's duration, so
          // lengthening it by a fraction of a sample interval moves where
          // every one of them starts and ends.
          const { instance } = leafInstance(store);
          const { animations, derivedSnapshot } = store.getState();
          const animation = animations[instance.animationId];
          const duration = Object.values(derivedSnapshot!.tracks).find(
            (track) => track.metadata?.instanceId === instance.id,
          )!.metadata!.duration;
          store.setState({
            animations: {
              ...animations,
              [animation.id]: { ...animation, defaultViewportExtent: duration + 345 },
            },
          });
        },
      ],
      [
        "the evaluator",
        (store) => {
          const evaluator = store.getState().trackEvaluator!;
          // Evaluates every key 1000 higher: past any limit.
          store.setState({
            trackEvaluator: {
              compile: (track) =>
                evaluator.compile({
                  ...track,
                  points: track.points.map((p) =>
                    typeof p.value === "number" ? { ...p, value: p.value + 1000 } : p,
                  ),
                }),
            },
          });
        },
      ],
      [
        "which instance a track key names",
        (store) => {
          // Two instances whose ids differ only in where a "/" falls share
          // their track keys: replacing one with the other keeps every key.
          const { namespace } = leafInstance(store);
          const [instance] = Object.values(namespace.animationInstances);
          const named = (namespaceId: string, instanceId: string) => ({
            ...namespace,
            id: namespaceId,
            animationInstances: { [instanceId]: { ...instance, id: instanceId } },
          });
          if (!store.getState().namespaces["a/b"]) {
            store.setState({
              namespaces: { ...store.getState().namespaces, "a/b": named("a/b", "c") },
            });
            return;
          }
          const { "a/b": _replaced, ...rest } = store.getState().namespaces;
          store.setState({ namespaces: { ...rest, a: named("a", "b/c") } });
        },
      ],
      [
        "which track a shared track key names",
        (store) => {
          // Namespace "a/i" playing track "t", and namespace "a" playing track
          // "i/t", through instances both named "i": their track keys are the
          // same. The tracks differ, so their violations do.
          const { namespace } = leafInstance(store);
          const [instance] = Object.values(namespace.animationInstances);
          const { trackId } = leafWithKey(store);
          const base = store.getState().tracks[trackId];
          const { animations, tracks } = store.getState();
          const animation = animations[instance.animationId];
          if (!store.getState().namespaces["a/i"]) {
            store.setState({
              tracks: {
                ...tracks,
                t: { ...base, id: "t" },
                "i/t": {
                  ...base,
                  id: "i/t",
                  points: base.points.map((p) =>
                    typeof p.value === "number" ? { ...p, value: p.value + 1000 } : p,
                  ),
                },
              },
              animations: {
                ...animations,
                plain: { ...animation, id: "plain", tracks: ["t"] },
                raised: { ...animation, id: "raised", tracks: ["i/t"] },
              },
              namespaces: {
                ...store.getState().namespaces,
                "a/i": {
                  ...namespace,
                  id: "a/i",
                  animationInstances: { i: { ...instance, id: "i", animationId: "plain" } },
                },
              },
            });
            return;
          }
          const { "a/i": _replaced, ...rest } = store.getState().namespaces;
          store.setState({
            namespaces: {
              ...rest,
              a: {
                ...namespace,
                id: "a",
                animationInstances: { i: { ...instance, id: "i", animationId: "raised" } },
              },
            },
          });
        },
      ],
      [
        "which instance a track key names in one namespace",
        (store) => {
          // In namespace "a", instance "b" playing track "c/t", and instance
          // "b/c" playing track "t": their track keys are the same.
          const { namespace } = leafInstance(store);
          const [instance] = Object.values(namespace.animationInstances);
          const { trackId } = leafWithKey(store);
          const base = store.getState().tracks[trackId];
          const { animations, tracks } = store.getState();
          const animation = animations[instance.animationId];
          const playing = (instanceId: string, animationId: string) => ({
            ...namespace,
            id: "a",
            animationInstances: { [instanceId]: { ...instance, id: instanceId, animationId } },
          });
          if (!store.getState().namespaces.a) {
            store.setState({
              tracks: {
                ...tracks,
                "c/t": { ...base, id: "c/t" },
                t: {
                  ...base,
                  id: "t",
                  points: base.points.map((p) =>
                    typeof p.value === "number" ? { ...p, value: p.value + 1000 } : p,
                  ),
                },
              },
              animations: {
                ...animations,
                plain: { ...animation, id: "plain", tracks: ["c/t"] },
                raised: { ...animation, id: "raised", tracks: ["t"] },
              },
              namespaces: { ...store.getState().namespaces, a: playing("b", "plain") },
            });
            return;
          }
          store.setState({
            namespaces: { ...store.getState().namespaces, a: playing("b/c", "raised") },
          });
        },
      ],
    ];

    it.each(edits)("%s", (name, edit) => {
      vi.useFakeTimers();
      try {
        const store = createCorpusStore();
        // The colliding cases first publish what they later replace.
        if (name.includes("key names")) edit(store);
        stallBuilding(store);
        const published = store.getState().derivedSnapshot;
        edit(store);
        const fresh = computeDerivedState(selectDerivedInputs(store.getState()), 0);
        expect(violationsOf(fresh)).not.toEqual(violationsOf(published));
        expect(violationsOf(currentDerivedSnapshot(store.getState()))).toEqual(violationsOf(fresh));
      } finally {
        vi.useRealTimers();
      }
    });
  });

  it("reports a provider's failure during a retry and retries again, still showing the edit", () => {
    vi.useFakeTimers();
    const report = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const store = createCorpusStore();
      stallBuilding(store);
      let failures = 1;
      store.setState({
        feedbackProvider: {
          canonical: (subjects, evaluator) => {
            if (failures > 0) {
              failures -= 1;
              throw new Error("provider failed");
            }
            return judged(subjects, evaluator);
          },
          preview: (subject, evaluator) => computeSubjectViolations(subject, evaluator),
        },
      });
      bumpKey(store);
      expect(() => vi.runAllTimers()).not.toThrow();
      expect(report).toHaveBeenCalledTimes(1);
      expect(isCurrent(store)).toBe(true);
    } finally {
      report.mockRestore();
      vi.useRealTimers();
    }
  });

  it.each([
    ["stops the store", (store: Store) => store.getState().stopAnimationSubscriptions()],
    ["sets no provider", (store: Store) => store.setState({ feedbackProvider: undefined })],
  ])("does not watch a provider when releasing the previous one %s", (_what, onRelease) => {
    const store = createCorpusStore();
    let releasing = false;
    store.setState({
      feedbackProvider: {
        canonical: judged,
        preview: (subject, evaluator) => computeSubjectViolations(subject, evaluator),
        subscribe: () => () => {
          if (releasing) return;
          releasing = true;
          onRelease(store);
        },
      },
    });
    const watching = new Set<() => void>();
    store.setState({
      feedbackProvider: {
        canonical: judged,
        preview: (subject, evaluator) => computeSubjectViolations(subject, evaluator),
        subscribe: (listener) => {
          watching.add(listener);
          return () => watching.delete(listener);
        },
      },
    });
    expect(releasing).toBe(true);
    expect(watching.size).toBe(0);
  });

  it("subscribes again to a provider whose subscribe threw", () => {
    const store = createCorpusStore();
    let subscribes = 0;
    let notify = () => {};
    let answer = 0;
    const provider: FeedbackProvider = {
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
        subscribes += 1;
        if (subscribes === 1) throw new Error("subscribe failed");
        notify = listener;
        return () => {
          notify = () => {};
        };
      },
    };
    expect(() => store.setState({ feedbackProvider: provider })).toThrow("subscribe failed");
    bumpKey(store);
    expect(subscribes).toBe(2);
    answer = 1;
    notify();
    const ends = Object.values(store.getState().derivedSnapshot!.tracks).map(
      (track) => track.canonical.violations[0]?.stampRange.end,
    );
    expect(new Set(ends)).toEqual(new Set([1]));
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
