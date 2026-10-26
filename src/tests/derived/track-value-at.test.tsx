// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { AnimationContext } from "../../context";
import { trackValueAt } from "../../functions/track-value-at";
import { useTrackValue } from "../../hooks/use-track-value";
import type { DerivedSnapshot, DerivedTrackSnapshot } from "../../types";
import { createTestAnimationStore } from "../../test-fixtures/animation-store-factory";
import { testTrackEvaluator } from "../../test-fixtures/track-evaluator";

/** A snapshot track whose curve is the identity of local time, plus `extra`. */
function track(extra: Partial<DerivedTrackSnapshot> = {}, metadata = {}): DerivedTrackSnapshot {
  return {
    canonical: { curve: (t) => t, derivative: () => 1, violations: [] },
    metadata: { animatableId: "a", duration: 1000, timescale: 1, offset: 0, ...metadata },
    ...extra,
  };
}

const snapshot = (tracks: Record<string, DerivedTrackSnapshot>): DerivedSnapshot =>
  ({ tracks, rows: {} }) as DerivedSnapshot;

describe("trackValueAt", () => {
  it("reads the track's curve at the instance's local time", () => {
    const s = snapshot({ "ns/i/t": track({}, { offset: 100, timescale: 2 }) });
    expect(trackValueAt(s, "ns/i/t", 300)).toBe(400);
  });

  it("reads the drag preview's curve while one is shown", () => {
    const s = snapshot({ "ns/i/t": track({ preview: { curve: (t) => -t } }) });
    expect(trackValueAt(s, "ns/i/t", 250)).toBe(-250);
  });

  it("holds no value for a muted track, a track the snapshot does not hold, or no snapshot", () => {
    const s = snapshot({ "ns/i/t": track({}, { muted: true }) });
    expect(trackValueAt(s, "ns/i/t", 250)).toBeUndefined();
    expect(trackValueAt(s, "ns/i/other", 250)).toBeUndefined();
    expect(trackValueAt(undefined, "ns/i/t", 250)).toBeUndefined();
  });

  it("reads a timescale of 0 as 1", () => {
    const s = snapshot({ "ns/i/t": track({}, { timescale: 0 }) });
    expect(trackValueAt(s, "ns/i/t", 250)).toBe(250);
  });
});

describe("useTrackValue", () => {
  it("re-renders when the track's value at the playhead changes, by a playhead move or an edit, and not on a snapshot rebuild that leaves it", () => {
    const store = createTestAnimationStore({ trackEvaluator: testTrackEvaluator });
    const player = store.getState().playerStore;
    const stamp = player.getState().player.stamp;
    const valueAt = (key: string, at: number) =>
      trackValueAt(store.getState().derivedSnapshot, key, at);
    // A track whose value differs between the playhead and 500 ms later.
    const key = Object.keys(store.getState().derivedSnapshot!.tracks).find(
      (k) => typeof valueAt(k, stamp) === "number" && valueAt(k, stamp) !== valueAt(k, stamp + 500),
    )!;
    expect(key).toBeDefined();
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(AnimationContext.Provider, { value: store }, children);
    let renders = 0;
    const { result } = renderHook(
      () => {
        renders++;
        return useTrackValue(key);
      },
      { wrapper },
    );
    const atStart = renders;
    expect(result.current).toBe(valueAt(key, stamp));

    // A selection rebuilds the snapshot; the value does not change.
    const before = store.getState().derivedSnapshot;
    act(() => store.getState().selectAll());
    expect(store.getState().derivedSnapshot).not.toBe(before);
    expect(renders).toBe(atStart);

    // The playhead moves to where the value differs.
    act(() => player.getState().resetPlayer(stamp + 500));
    expect(renders).toBe(atStart + 1);
    expect(result.current).toBe(valueAt(key, stamp + 500));

    // An edit raises the curve under the playhead, which holds.
    const moved = result.current;
    const trackId = store.getState().derivedSnapshot!.tracks[key as never].metadata!.trackId!;
    const edited = store.getState().tracks[trackId];
    act(() =>
      store.setState({
        tracks: {
          ...store.getState().tracks,
          [trackId]: {
            ...edited,
            points: edited.points.map((p) => ({ ...p, value: (p.value as number) + 1 })),
          },
        },
      }),
    );
    expect(renders).toBe(atStart + 2);
    expect(result.current).toBeCloseTo((moved as number) + 1, 3);
  });
});
