import { describe, expect, it, vi } from "vitest";
import {
  computeDerivedState,
  retryDelay,
  selectDerivedInputs,
} from "../../../subscriptions/init-derived-orchestrator";
import type { FeedbackProvider } from "../../../functions/feedback-provider";
import type { DerivedSnapshot, TrackKey, Violation } from "../../../types";
import { violationId } from "../../../functions/compute-track-violations";
import { corpusSteps, createCorpusStore, normalize, runStep } from "./edit-corpus";

const SEEDS = [3, 5, 8, 13, 21, 34];
const LENGTH = 30;

function violationsIn(snapshot: DerivedSnapshot): Violation[] {
  return placedViolationsIn(snapshot).map(([, violation]) => violation);
}

/**
 * Every violation in a snapshot with the list it is in. A track's canonical
 * and preview lists may hold violations with the same id and different
 * content (a drag moves where one ends, not where it starts), so a violation
 * is identified by its list and its id together.
 */
function placedViolationsIn(snapshot: DerivedSnapshot): [string, Violation][] {
  const out: [string, Violation][] = [];
  Object.entries(snapshot.tracks).forEach(([key, track]) => {
    track.canonical.violations.forEach((v) => out.push([`${key} canonical ${v.id}`, v]));
    (track.preview?.violations ?? []).forEach((v) => out.push([`${key} preview ${v.id}`, v]));
  });
  Object.entries(snapshot.rows).forEach(([rowId, row]) => {
    Object.values(row.computed.violationSet?.violations ?? {}).forEach((v) =>
      out.push([`row ${rowId} ${v.id}`, v]),
    );
  });
  return out;
}

/**
 * The store builds its snapshot once per write, from violations its feedback
 * provider may have cached, and keeps unchanged rows' source objects. The
 * snapshot it holds after every step must equal one built afresh from the
 * same inputs with nothing cached.
 */
function numericTrackId(store: ReturnType<typeof createCorpusStore>): string {
  const { tracks } = store.getState();
  return Object.keys(tracks).find((id) => typeof tracks[id].points[0]?.value === "number")!;
}

describe("cached derived build", () => {
  it.each(SEEDS)(
    "matches an uncached build after every step of corpus seed %i",
    (seed) => {
      const store = createCorpusStore();
      let step = 0;
      for (const corpusStep of corpusSteps(seed, LENGTH)) {
        const before = store.getState().derivedSnapshot?.version ?? 0;
        const where = `${corpusStep.label} (step ${step})`;
        // No corpus step fails; one that did could leave the state unchanged
        // and still compare equal to a fresh build of it.
        expect(runStep(store, corpusStep), where).toBeUndefined();
        const state = store.getState();

        // One outermost action is one write or a few in sequence; each builds
        // at most once.
        expect(state.derivedSnapshot!.version! - before, where).toBeLessThanOrEqual(3);

        const fresh = computeDerivedState(selectDerivedInputs(state), 0);
        expect(normalize(state.derivedSnapshot), where).toEqual(normalize(fresh));

        // Violation ids are their content, so the cached and fresh builds agree
        // on them exactly, not only up to renaming.
        violationsIn(state.derivedSnapshot!).forEach((violation) => {
          expect(violation.id, where).toBe(
            violationId(
              violation.namespace,
              violation.instanceId,
              violation.trackId,
              violation.type,
              violation.stampRange.start,
            ),
          );
        });
        Object.entries(state.derivedSnapshot!.rows).forEach(([rowId, row]) => {
          expect(row.computed.violationSet?.id, `${where} row ${rowId}`).toBe(
            fresh.rows[rowId]?.computed.violationSet?.id,
          );
        });
        step += 1;
      }
    },
    120_000,
  );

  // Renderers key elements by violation and segment id and memoize on object
  // identity. A stable id is safe only while two things hold: no two
  // violations a renderer sees share an id (a violation set is keyed by id, so
  // a shared one would silently drop a violation), and anything whose content
  // changed arrives as a new object, so a memo keyed by identity sees it.
  it.each(SEEDS)(
    "gives renderers unique ids and new objects for changed content, seed %i",
    (seed) => {
      const store = createCorpusStore();
      let previous = store.getState().derivedSnapshot!;
      let step = 0;
      for (const corpusStep of corpusSteps(seed, LENGTH)) {
        const where = `${corpusStep.label} (step ${step})`;
        expect(runStep(store, corpusStep), where).toBeUndefined();
        const snapshot = store.getState().derivedSnapshot!;

        Object.entries(snapshot.tracks).forEach(([key, track]) => {
          [track.canonical.violations, track.preview?.violations ?? []].forEach((list) => {
            const ids = list.map((violation) => violation.id);
            expect(new Set(ids).size, `${where} ${key}`).toBe(ids.length);
          });
        });

        // What changed is judged against a build from nothing cached: an object
        // reused by mistake would otherwise compare equal to itself.
        const fresh = computeDerivedState(selectDerivedInputs(store.getState()), 0);
        const before = new Map(placedViolationsIn(previous));
        const now = new Map(placedViolationsIn(snapshot));
        placedViolationsIn(fresh).forEach(([place, violation]) => {
          const old = before.get(place);
          if (old && JSON.stringify(old) !== JSON.stringify(violation)) {
            expect(now.get(place), `${where} ${place}`).not.toBe(old);
          }
        });
        const previousRows = previous.rows;
        Object.entries(fresh.rows).forEach(([rowId, row]) => {
          const old = previousRows[rowId]?.computed.violationSet;
          if (old && JSON.stringify(old) !== JSON.stringify(row.computed.violationSet)) {
            expect(snapshot.rows[rowId]?.computed.violationSet, `${where} row ${rowId}`).not.toBe(
              old,
            );
          }
        });

        previous = snapshot;
        step += 1;
      }
    },
    120_000,
  );

  it("builds once per outermost write", () => {
    const store = createCorpusStore();
    const state = store.getState();
    const trackId = Object.keys(state.tracks).find(
      (id) => typeof state.tracks[id].points[0]?.value === "number",
    )!;
    const point = state.tracks[trackId].points[0];

    const versions: number[] = [];
    const unsubscribe = store.subscribe((s) => versions.push(s.derivedSnapshot?.version ?? 0));
    const before = store.getState().derivedSnapshot!.version!;
    store.getState().updateKeypoint(trackId, { id: point.id, value: (point.value as number) + 1 });
    unsubscribe();

    expect(store.getState().derivedSnapshot!.version! - before).toBe(1);
    // A listener subscribed after the store's own sees the new snapshot already
    // on the write's own notification.
    expect(versions.at(-1)).toBe(before + 1);
  });

  it("keeps a track's violations across a write to another track", () => {
    const store = createCorpusStore();
    const before = store.getState().derivedSnapshot!;
    const withViolations = (Object.keys(before.tracks) as TrackKey[]).filter(
      (key) => before.tracks[key].canonical.violations.length > 0,
    );
    const trackId = before.tracks[withViolations[0]].metadata?.trackId ?? "";
    expect(trackId).not.toBe("");
    const untouched = withViolations.filter(
      (key) => before.tracks[key].metadata?.trackId !== trackId,
    );
    expect(untouched.length).toBeGreaterThan(0);
    const track = store.getState().tracks[trackId];
    store.getState().updateKeypoint(trackId, {
      id: track.points[0].id,
      value: (track.points[0].value as number) + 0.5,
    });
    const after = store.getState().derivedSnapshot!;
    untouched.forEach((key) => {
      expect(after.tracks[key].canonical.violations).toBe(before.tracks[key].canonical.violations);
    });
  });

  it("leaves the source rows' identity alone when a write changes none of them", () => {
    const store = createCorpusStore();
    const { instancedTrackSources, sourceRowIds, sourceRowIdsByView } = store.getState();
    const state = store.getState();
    const trackId = Object.keys(state.tracks).find(
      (id) => typeof state.tracks[id].points[0]?.value === "number",
    )!;
    const point = state.tracks[trackId].points[0];
    store.getState().updateKeypoint(trackId, { id: point.id, value: (point.value as number) + 1 });
    const next = store.getState();
    expect(next.sourceRowIds).toBe(sourceRowIds);
    expect(next.sourceRowIdsByView).toBe(sourceRowIdsByView);
    Object.keys(instancedTrackSources).forEach((rowId) => {
      expect(next.instancedTrackSources[rowId], rowId).toBe(instancedTrackSources[rowId]);
    });
  });

  it("shows a host listener the snapshot for the inputs it is notified of", () => {
    const store = createCorpusStore();
    const trackId = numericTrackId(store);
    const seen: (number | undefined)[] = [];
    // Subscribed after the store's own subscriptions, which answer a tracks
    // write with nested writes of their own.
    const unsubscribe = store.subscribe(
      (s) => s.tracks,
      () => seen.push(store.getState().derivedSnapshot?.version),
    );
    const point = store.getState().tracks[trackId].points[0];
    store.getState().updateKeypoint(trackId, { id: point.id, value: (point.value as number) + 1 });
    unsubscribe();
    expect(seen).toEqual([store.getState().derivedSnapshot!.version]);
    const fresh = computeDerivedState(selectDerivedInputs(store.getState()), 0);
    expect(normalize(store.getState().derivedSnapshot)).toEqual(normalize(fresh));
  });

  it("keeps building after a listener throws", () => {
    const store = createCorpusStore();
    const trackId = numericTrackId(store);
    let throwOnce = true;
    const unsubscribe = store.subscribe(() => {
      if (throwOnce) {
        throwOnce = false;
        throw new Error("listener failed");
      }
    });
    const point = () => store.getState().tracks[trackId].points[0];
    expect(() => store.getState().updateKeypoint(trackId, { id: point().id, value: 5 })).toThrow(
      "listener failed",
    );
    store.getState().updateKeypoint(trackId, { id: point().id, value: 7 });
    unsubscribe();
    const fresh = computeDerivedState(selectDerivedInputs(store.getState()), 0);
    expect(normalize(store.getState().derivedSnapshot)).toEqual(normalize(fresh));
  });

  it("rebuilds when a provider reports a change while it is being asked", () => {
    const listeners = new Set<() => void>();
    let calls = 0;
    const provider: FeedbackProvider = {
      canonical: (subjects) => {
        calls += 1;
        // The first answer is out of date as soon as it is given.
        if (calls === 1) listeners.forEach((listener) => listener());
        return new Map(subjects.map((subject) => [subject.trackKey, []]));
      },
      preview: () => [],
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };
    const store = createCorpusStore();
    calls = 0;
    store.setState({ feedbackProvider: provider });
    expect(calls).toBe(2);
  });

  it("shows an action called from a snapshot listener its own snapshot", () => {
    const store = createCorpusStore();
    const trackId = numericTrackId(store);
    const pointId = store.getState().tracks[trackId].points[0].id;
    const valueAt = () => {
      const state = store.getState();
      const point = state.tracks[trackId].points.find((p) => p.id === pointId)!;
      const key = (Object.keys(state.derivedSnapshot!.tracks) as TrackKey[]).find(
        (k) => state.derivedSnapshot!.tracks[k].metadata?.trackId === trackId,
      )!;
      return state.derivedSnapshot!.tracks[key].canonical.curve(point.stamp);
    };
    let seen: unknown;
    let once = true;
    const unsubscribe = store.subscribe(
      (s) => s.derivedSnapshot,
      () => {
        if (!once) return;
        once = false;
        store.getState().updateKeypoint(trackId, { id: pointId, value: 0.3 });
        seen = valueAt();
      },
    );
    store.getState().updateKeypoint(trackId, { id: pointId, value: 0.1 });
    unsubscribe();
    expect(seen).toBeCloseTo(0.3);
    expect(valueAt()).toBeCloseTo(0.3);
  });

  // A provider that answers late needs no write to be shown: its notification
  // alone rebuilds.
  it("rebuilds when a provider reports a change between writes", () => {
    const listeners = new Set<() => void>();
    let end = 1;
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
                stampRange: { start: 0, end },
              } as Violation,
            ],
          ]),
        ),
      preview: () => [],
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };
    const store = createCorpusStore();
    store.setState({ feedbackProvider: provider });
    end = 2;
    listeners.forEach((listener) => listener());
    const tracks = Object.values(store.getState().derivedSnapshot!.tracks);
    expect(tracks.length).toBeGreaterThan(0);
    tracks.forEach((track) => expect(track.canonical.violations[0].stampRange.end).toBe(2));
  });

  // A provider whose answer, while it is being asked, is already out of date:
  // each answer counts up to `last`, reporting a change as it gives it. The
  // store may also be written to while it is asked.
  function changingProvider(last: number, onAsk?: () => void) {
    let notify = () => {};
    let answer = 0;
    const provider: FeedbackProvider = {
      canonical: (subjects) => {
        const current = answer;
        onAsk?.();
        if (answer < last) {
          answer += 1;
          notify();
        }
        return new Map(
          subjects.map((subject) => [
            subject.trackKey,
            [
              {
                id: `v${current}:${subject.trackKey}`,
                trackId: subject.trackId,
                namespace: subject.namespaceId,
                instanceId: subject.instanceId,
                type: "upper",
                stampRange: { start: 0, end: current },
              } as Violation,
            ],
          ]),
        );
      },
      preview: () => [],
      subscribe: (listener) => {
        notify = listener;
        return () => {
          notify = () => {};
        };
      },
    };
    return provider;
  }

  const endsShown = (store: ReturnType<typeof createCorpusStore>) =>
    Object.values(store.getState().derivedSnapshot!.tracks).map(
      (track) => track.canonical.violations[0].stampRange.end,
    );

  it.each([12, 40])("settles a provider's chain of %i changes", (changes) => {
    vi.useFakeTimers();
    try {
      const store = createCorpusStore();
      store.setState({ feedbackProvider: changingProvider(changes) });
      vi.runAllTimers();
      expect(vi.getTimerCount()).toBe(0);
      expect(new Set(endsShown(store))).toEqual(new Set([changes]));
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows an edit made while building is stopped", () => {
    vi.useFakeTimers();
    try {
      const store = createCorpusStore();
      store.setState({ feedbackProvider: changingProvider(40) });
      vi.runOnlyPendingTimers();
      expect(vi.getTimerCount()).toBe(1);
      const trackId = numericTrackId(store);
      const pointId = store.getState().tracks[trackId].points[0].id;
      store.getState().updateKeypoint(trackId, { id: pointId, value: 0.42 });
      vi.runAllTimers();
      const fresh = computeDerivedState(
        selectDerivedInputs(store.getState()),
        0,
        store.getState().feedbackProvider,
      );
      expect(normalize(store.getState().derivedSnapshot)).toEqual(normalize(fresh));
    } finally {
      vi.useRealTimers();
    }
  });

  it("retries a new chain of changes at once after the last one settled", () => {
    vi.useFakeTimers();
    try {
      const store = createCorpusStore();
      // Long enough to back off: 31 builds run out four budgets.
      store.setState({ feedbackProvider: changingProvider(30) });
      vi.runAllTimers();
      store.setState({ feedbackProvider: changingProvider(12) });
      vi.advanceTimersByTime(0);
      expect(new Set(endsShown(store))).toEqual(new Set([12]));
    } finally {
      vi.useRealTimers();
    }
  }, 30_000);

  it("waits twice as long before each further retry in a chain, up to a second", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 20].map(retryDelay)).toEqual([
      0, 50, 100, 200, 400, 800, 1000, 1000, 1000,
    ]);
  });

  it("cancels a pending retry when the store's subscriptions stop", () => {
    vi.useFakeTimers();
    try {
      const store = createCorpusStore();
      store.setState({ feedbackProvider: changingProvider(12) });
      expect(vi.getTimerCount()).toBe(1);
      store.getState().stopAnimationSubscriptions();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows a provider's latest answer when it writes to the store while asked", () => {
    const store = createCorpusStore();
    let wrote = false;
    const provider = changingProvider(1, () => {
      if (wrote) return;
      wrote = true;
      // A write to state the snapshot does not read: nothing about it calls
      // for another build, so only the answer reported after it can.
      store.setState({ unrelatedToTheSnapshot: true } as never);
    });
    store.setState({ feedbackProvider: provider });
    expect(new Set(endsShown(store))).toEqual(new Set([1]));
    const fresh = computeDerivedState(selectDerivedInputs(store.getState()), 0, provider);
    expect(normalize(store.getState().derivedSnapshot)).toEqual(normalize(fresh));
  });

  // A host listener that answers every snapshot with a new edit never lets
  // the inputs settle. The store must neither loop on the write's task nor
  // recurse once per build, and later retries must back off.
  it("backs off for a listener that answers every snapshot with an edit", () => {
    vi.useFakeTimers();
    try {
      const store = createCorpusStore();
      const trackId = numericTrackId(store);
      const pointId = store.getState().tracks[trackId].points[0].id;
      let edits = 0;
      const unsubscribe = store.subscribe(
        (s) => s.derivedSnapshot,
        () => {
          edits += 1;
          store.getState().updateKeypoint(trackId, { id: pointId, value: (edits % 7) * 0.01 });
        },
      );
      const version = () => store.getState().derivedSnapshot!.version!;
      const before = version();
      store.getState().updateKeypoint(trackId, { id: pointId, value: 0.5 });
      // The write's own budget, and one retry pending.
      expect(version() - before).toBe(8);
      expect(vi.getTimerCount()).toBe(1);
      // The first retry runs on the next task.
      vi.advanceTimersByTime(0);
      expect(version() - before).toBe(16);
      // The next waits.
      vi.advanceTimersByTime(49);
      expect(version() - before).toBe(16);
      vi.advanceTimersByTime(1);
      expect(version() - before).toBe(24);
      // Once the listener is gone, the pending retry settles the inputs and
      // nothing more is scheduled.
      unsubscribe();
      vi.runAllTimers();
      expect(vi.getTimerCount()).toBe(0);
      const fresh = computeDerivedState(selectDerivedInputs(store.getState()), 0);
      expect(normalize(store.getState().derivedSnapshot)).toEqual(normalize(fresh));
    } finally {
      vi.useRealTimers();
    }
  });

  it("recomputes cached violations when the evaluator changes", () => {
    const store = createCorpusStore();
    const before = store.getState().derivedSnapshot!;
    expect(violationsIn(before).length).toBeGreaterThan(0);
    // Without an evaluator no curve compiles, so nothing can be judged.
    store.setState({ trackEvaluator: undefined });
    const fresh = computeDerivedState(selectDerivedInputs(store.getState()), 0);
    expect(normalize(store.getState().derivedSnapshot)).toEqual(normalize(fresh));
    expect(violationsIn(store.getState().derivedSnapshot!)).toEqual([]);
  });
});
