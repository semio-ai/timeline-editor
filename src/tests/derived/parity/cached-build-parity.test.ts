import { describe, expect, it } from "vitest";
import {
  computeDerivedState,
  selectDerivedInputs,
} from "../../../subscriptions/init-derived-orchestrator";
import type { FeedbackProvider } from "../../../functions/feedback-provider";
import type { DerivedSnapshot, TrackKey, Violation } from "../../../types";
import {
  corpusSteps,
  createCorpusStore,
  normalize,
  runStep,
  violationContentKey,
} from "./edit-corpus";

const SEEDS = [3, 5, 8, 13, 21, 34];
const LENGTH = 30;

function violationsIn(snapshot: DerivedSnapshot): Violation[] {
  const out: Violation[] = [];
  Object.values(snapshot.tracks).forEach((track) => {
    out.push(...track.canonical.violations, ...(track.preview?.violations ?? []));
  });
  Object.values(snapshot.rows).forEach((row) => {
    out.push(...Object.values(row.computed.violationSet?.violations ?? {}));
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
        runStep(store, corpusStep);
        const state = store.getState();
        const where = `${corpusStep.label} (step ${step})`;

        // One outermost action is one write or a few in sequence; each builds
        // at most once.
        expect(state.derivedSnapshot!.version! - before, where).toBeLessThanOrEqual(3);

        const fresh = computeDerivedState(selectDerivedInputs(state), 0);
        expect(normalize(state.derivedSnapshot), where).toEqual(normalize(fresh));

        // Violation ids are their content, so the cached and fresh builds agree
        // on them exactly, not only up to renaming.
        violationsIn(state.derivedSnapshot!).forEach((violation) => {
          expect(violation.id, where).toBe(`violation:${violationContentKey(violation)}`);
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
});
