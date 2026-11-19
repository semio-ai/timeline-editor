// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { AnimationContext } from "../../context";
import { useKeyControlState } from "../../hooks/use-key-control-state";
import { useTrackValueReader } from "../../hooks/use-track-value-reader";
import { trackValueAt } from "../../functions/track-value-at";
import { currentDerivedSnapshot } from "../../subscriptions/init-derived-orchestrator";
import { buildTrackKey } from "../../utils/track-key";
import { createCorpusStore } from "./parity/edit-corpus";

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
      track.points.length > 1 &&
      typeof track.points[0].value === "number"
    );
  })!;
  const trackId = row.data[0].trackId;
  return { row, trackId, point: state.tracks[trackId].points[0] };
}

/**
 * Runs out the build budget with a listener that answers every snapshot with
 * a write, then removes it: building stays stalled, so the published snapshot
 * trails every edit after this.
 */
function stallBuilding(store: Store) {
  const touchViews = () => store.setState({ editorViews: { ...store.getState().editorViews } });
  const unsubscribe = store.subscribe((s) => s.derivedSnapshot, touchViews);
  touchViews();
  unsubscribe();
  expect(vi.getTimerCount()).toBe(1);
}

/** Rewrites one key of a track. */
function editKey(store: Store, trackId: string, keyId: string, change: object) {
  const track = store.getState().tracks[trackId];
  store.setState({
    tracks: {
      ...store.getState().tracks,
      [trackId]: {
        ...track,
        points: track.points.map((p) => (p.id === keyId ? { ...p, ...change } : p)),
      },
    },
  });
}

function wrapperFor(store: Store) {
  return function StoreProvider({ children }: { children: ReactNode }) {
    return createElement(AnimationContext.Provider, { value: store }, children);
  };
}

describe("an event handler acts on the state as it is, not on a published snapshot that trails it", () => {
  it("reads a track's value for a new key from the current state", () => {
    vi.useFakeTimers();
    try {
      const store = createCorpusStore();
      const { row, trackId, point } = leafWithKey(store);
      const datum = row.data[0];
      const key = buildTrackKey(datum.namespaceId, datum.instanceId, trackId);
      // The key's world time, by skipping to it.
      store.getState().playerStore.getState().resetPlayer(-1e9);
      store.getState().skipToNextKeyframe(row);
      const at = store.getState().playerStore.getState().player.stamp;
      stallBuilding(store);
      editKey(store, trackId, point.id, { value: (point.value as number) + 3 });
      const { result } = renderHook(() => useTrackValueReader(), { wrapper: wrapperFor(store) });
      const read = result.current(key, at);
      expect(read).toBe(trackValueAt(currentDerivedSnapshot(store.getState()), key, at));
      expect(read).not.toBe(trackValueAt(store.getState().derivedSnapshot, key, at));
    } finally {
      vi.useRealTimers();
    }
  });

  it("finds no key at the playhead once the key there has moved", () => {
    vi.useFakeTimers();
    try {
      const store = createCorpusStore();
      const { row, trackId, point } = leafWithKey(store);
      store.getState().playerStore.getState().resetPlayer(-1e9);
      store.getState().skipToNextKeyframe(row);
      const { result } = renderHook(() => useKeyControlState(row), {
        wrapper: wrapperFor(store),
      });
      expect(result.current.keyStateNow().keyState).toBe("full");
      stallBuilding(store);
      const next = store.getState().tracks[trackId].points[1];
      editKey(store, trackId, point.id, { stamp: Math.round((point.stamp + next.stamp) / 2) });
      // The strip still shows the published snapshot's key; a handler sees none.
      expect(result.current.keyState).toBe("full");
      expect(result.current.keyStateNow().keyState).toBe("none");
    } finally {
      vi.useRealTimers();
    }
  });
});
