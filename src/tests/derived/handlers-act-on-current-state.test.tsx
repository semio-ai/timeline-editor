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
import { computeLocalStamp, computeWorldStamp } from "../../functions";
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

  it("finds the key at the playhead by its instance's time transform as it is now", () => {
    vi.useFakeTimers();
    try {
      const store = createCorpusStore();
      const { row, trackId, point } = leafWithKey(store);
      const instanceId = row.data[0].instanceId;
      const namespaceId = row.data[0].namespaceId;
      store.getState().playerStore.getState().resetPlayer(-1e9);
      store.getState().skipToNextKeyframe(row);
      const { result } = renderHook(() => useKeyControlState(row), {
        wrapper: wrapperFor(store),
      });
      expect(result.current.keyStateNow().keyState).toBe("full");
      // The key and its instance's offset move together, so the key stays at
      // the playhead in world time while its local stamp changes.
      stallBuilding(store);
      const namespace = store.getState().namespaces[namespaceId];
      const instance = namespace.animationInstances[instanceId];
      const offset = instance.settings.offset ?? 0;
      const stamp = store.getState().playerStore.getState().player.stamp;
      store.setState({
        namespaces: {
          ...store.getState().namespaces,
          [namespaceId]: {
            ...namespace,
            animationInstances: {
              ...namespace.animationInstances,
              [instanceId]: {
                ...instance,
                settings: { ...instance.settings, offset: offset - 123 },
              },
            },
          },
        },
      });
      const local = computeLocalStamp(stamp, instance.settings.timescale, offset - 123);
      editKey(store, trackId, point.id, { stamp: local });
      expect(local).not.toBe(point.stamp);
      expect(result.current.keyStateNow().keyState).toBe("full");
      // A key added there goes at the instance's local time now.
      expect(result.current.keyStateNow().playheadIn(instanceId)).toBe(local);
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows and acts on the same key with no transform provider above it", () => {
    const store = createCorpusStore();
    const { row, point } = leafWithKey(store);
    const { namespaceId, instanceId } = row.data[0];
    const namespace = store.getState().namespaces[namespaceId];
    const instance = namespace.animationInstances[instanceId];
    store.setState({
      namespaces: {
        ...store.getState().namespaces,
        [namespaceId]: {
          ...namespace,
          animationInstances: {
            ...namespace.animationInstances,
            [instanceId]: { ...instance, settings: { ...instance.settings, offset: 250 } },
          },
        },
      },
    });
    store
      .getState()
      .playerStore.getState()
      .resetPlayer(computeWorldStamp(point.stamp, instance.settings.timescale, 250));
    const current = store.getState().instancedTrackSources[row.id];
    const { result } = renderHook(() => useKeyControlState(current), {
      wrapper: wrapperFor(store),
    });
    expect(result.current.keyState).toBe("full");
    expect(result.current.keyStateNow().keyState).toBe("full");
  });

  it("converts between world and the instance's local time by its timescale and offset", () => {
    const store = createCorpusStore();
    const { row, trackId } = leafWithKey(store);
    const { namespaceId, instanceId } = row.data[0];
    const namespace = store.getState().namespaces[namespaceId];
    const instance = namespace.animationInstances[instanceId];
    store.setState({
      namespaces: {
        ...store.getState().namespaces,
        [namespaceId]: {
          ...namespace,
          animationInstances: {
            ...namespace.animationInstances,
            [instanceId]: {
              ...instance,
              settings: { ...instance.settings, timescale: 2, offset: 250 },
            },
          },
        },
      },
    });
    const [first, second] = store.getState().tracks[trackId].points;
    // On the second key, by its world time: away from local 0, where a
    // timescale changes nothing.
    expect(second.stamp).not.toBe(0);
    store
      .getState()
      .playerStore.getState()
      .resetPlayer(computeWorldStamp(second.stamp, 2, 250));
    const current = store.getState().instancedTrackSources[row.id];
    const { result } = renderHook(() => useKeyControlState(current), {
      wrapper: wrapperFor(store),
    });
    expect(result.current.keyState).toBe("full");
    // The previous key, back in world time.
    expect(result.current.prevTime).toBe(computeWorldStamp(first.stamp, 2, 250));
  });
});
