// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { expect, it, vi } from "vitest";
import { AnimationContext } from "../../context";
import { useControlMenu } from "../../hooks/use-control-menu";
import { createCorpusStore } from "./parity/edit-corpus";

vi.mock("@semio/ui", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useKeybindingMap: () => ({}),
}));

type Store = ReturnType<typeof createCorpusStore>;

function StoreProviderFor(store: Store) {
  return function StoreProvider({ children }: { children: ReactNode }) {
    return createElement(AnimationContext.Provider, { value: store }, children);
  };
}

it("adds a key at the playhead, rather than removing one, once the key there has moved", () => {
  vi.useFakeTimers();
  try {
    const store = createCorpusStore();
    const state = store.getState();
    const row = Object.values(state.instancedTrackSources).find(
      (candidate) =>
        !candidate.isGroup &&
        candidate.data.length === 1 &&
        candidate.data[0].instanceId === state.selectionState.instanceId &&
        (state.tracks[candidate.data[0].trackId]?.points.length ?? 0) > 1,
    )!;
    const trackId = row.data[0].trackId;
    const [first, second] = state.tracks[trackId].points;
    state.playerStore.getState().resetPlayer(-1e9);
    store.getState().skipToNextKeyframe(row);
    const { result } = renderHook(
      () =>
        useControlMenu({ sourceRow: row, trackIds: [trackId], isGroup: false, allReadonly: false }),
      { wrapper: StoreProviderFor(store) },
    );
    expect(result.current.keyState).toBe("full");

    // Building stalls, and the key at the playhead moves away.
    const touchViews = () => store.setState({ editorViews: { ...store.getState().editorViews } });
    const unsubscribe = store.subscribe((s) => s.derivedSnapshot, touchViews);
    touchViews();
    unsubscribe();
    expect(vi.getTimerCount()).toBe(1);
    const track = store.getState().tracks[trackId];
    const moved = Math.round((first.stamp + second.stamp) / 2);
    store.setState({
      tracks: {
        ...store.getState().tracks,
        [trackId]: {
          ...track,
          points: track.points.map((p) => (p.id === first.id ? { ...p, stamp: moved } : p)),
        },
      },
    });

    result.current.handleToggleKeyframe();
    const points = store.getState().tracks[trackId].points;
    // The moved key is still there, and a new one sits where it was.
    expect(points.find((p) => p.id === first.id)?.stamp).toBe(moved);
    expect(points).toHaveLength(track.points.length + 1);
  } finally {
    vi.useRealTimers();
  }
});

/** A row of two or more tracks of the active instance that all have a key at one stamp. */
function rowKeyedTogether(store: Store) {
  const state = store.getState();
  for (const row of Object.values(state.instancedTrackSources)) {
    if (row.data.length < 2) continue;
    if (row.data.some((datum) => datum.instanceId !== state.selectionState.instanceId)) continue;
    const stampsOf = (trackId: string) =>
      new Set(state.tracks[trackId]?.points.map((p) => p.stamp) ?? []);
    const [firstDatum, ...rest] = row.data;
    const shared = [...stampsOf(firstDatum.trackId)].find((stamp) =>
      rest.every((datum) => stampsOf(datum.trackId).has(stamp)),
    );
    if (shared !== undefined) return { row, stamp: shared };
  }
  throw new Error("No row whose tracks share a key stamp.");
}

/** Moves a track's key at `from` to `to`. */
function moveKey(store: Store, trackId: string, from: number, to: number) {
  const track = store.getState().tracks[trackId];
  store.setState({
    tracks: {
      ...store.getState().tracks,
      [trackId]: {
        ...track,
        points: track.points.map((p) => (p.stamp === from ? { ...p, stamp: to } : p)),
      },
    },
  });
}

function stall(store: Store) {
  const touchViews = () => store.setState({ editorViews: { ...store.getState().editorViews } });
  const unsubscribe = store.subscribe((s) => s.derivedSnapshot, touchViews);
  touchViews();
  unsubscribe();
  expect(vi.getTimerCount()).toBe(1);
}

/** The control menu of `row`, with the playhead on the world time of `row`'s key at `stamp`. */
function menuAt(store: Store, row: ReturnType<typeof rowKeyedTogether>["row"], stamp: number) {
  const instance = Object.values(store.getState().namespaces)
    .map((namespace) => namespace.animationInstances[row.data[0].instanceId])
    .find(Boolean)!;
  const world = stamp * (instance.settings.timescale || 1) + (instance.settings.offset ?? 0);
  store.getState().playerStore.getState().resetPlayer(world);
  return renderHook(
    () =>
      useControlMenu({
        sourceRow: row,
        trackIds: row.data.map((datum) => datum.trackId),
        isGroup: true,
        allReadonly: false,
      }),
    { wrapper: StoreProviderFor(store) },
  );
}

it("removes the keys at the playhead once a key has moved onto it", () => {
  vi.useFakeTimers();
  try {
    const store = createCorpusStore();
    const { row, stamp } = rowKeyedTogether(store);
    const [moving] = row.data;
    // One track's key starts elsewhere, so the row shows a partial key.
    moveKey(store, moving.trackId, stamp, stamp + 7);
    const { result } = menuAt(store, row, stamp);
    expect(result.current.keyState).toBe("partial");
    stall(store);
    moveKey(store, moving.trackId, stamp + 7, stamp);
    result.current.handleToggleKeyframe();
    row.data.forEach((datum) =>
      expect(
        store.getState().tracks[datum.trackId].points.some((p) => p.stamp === stamp),
        datum.trackId,
      ).toBe(false),
    );
  } finally {
    vi.useRealTimers();
  }
});

it("adds a key to the track that now lacks one, not to the one that lacked one before", () => {
  vi.useFakeTimers();
  try {
    const store = createCorpusStore();
    const { row, stamp } = rowKeyedTogether(store);
    const [before, now] = row.data;
    moveKey(store, before.trackId, stamp, stamp + 7);
    const { result } = menuAt(store, row, stamp);
    expect(result.current.keyState).toBe("partial");
    stall(store);
    // The first track's key comes back, and the second's moves away.
    moveKey(store, before.trackId, stamp + 7, stamp);
    moveKey(store, now.trackId, stamp, stamp + 7);
    const counts = row.data.map((datum) => store.getState().tracks[datum.trackId].points.length);
    result.current.handleAddKeyframe();
    const keyedAt = (trackId: string) =>
      store.getState().tracks[trackId].points.some((p) => p.stamp === stamp);
    expect(keyedAt(now.trackId)).toBe(true);
    row.data.forEach((datum, i) =>
      expect(store.getState().tracks[datum.trackId].points.length, datum.trackId).toBe(
        counts[i] + (datum.trackId === now.trackId ? 1 : 0),
      ),
    );
  } finally {
    vi.useRealTimers();
  }
});
