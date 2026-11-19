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
