// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { expect, it, vi } from "vitest";
import { AnimationContext } from "../../context";
import { computeWorldStamp } from "../../functions";
import { useKeyControlState } from "../../hooks/use-key-control-state";
import {
  createTestAnimationStore,
  INSTANCE_IDS,
  NAMESPACE_IDS,
  TRACK_IDS,
} from "../../test-fixtures/animation-store-factory";
import { testTrackEvaluator } from "../../test-fixtures/track-evaluator";
import { flushMicrotasks } from "../utils/flush-microtasks";

const ROW = `${NAMESPACE_IDS.BETA}/${INSTANCE_IDS.BETA_SHARED}/${TRACK_IDS.OPACITY}`;

/**
 * The key strip compares the playhead with its row's frames in the time the
 * row was built in. While a rebuild is held back, the instance's timing can
 * already have changed; the strip still finds the key the row shows.
 */
it("finds the key under the playhead through the time its row was built in", async () => {
  const store = createTestAnimationStore({
    trackEvaluator: testTrackEvaluator,
    activeInstance: INSTANCE_IDS.BETA_SHARED,
  });
  const cleanup = store.getState().initAnimationSubscriptions();
  await flushMicrotasks();
  vi.useFakeTimers();
  try {
    const key = store.getState().tracks[TRACK_IDS.OPACITY].points.find((p) => p.stamp !== 0)!;
    const settings =
      store.getState().namespaces[NAMESPACE_IDS.BETA].animationInstances[INSTANCE_IDS.BETA_SHARED]
        .settings;
    const shownAt = computeWorldStamp(key.stamp, settings.timescale, settings.offset);

    // Hold building back until the retry, then change the instance's speed.
    const touchViews = () => store.setState({ editorViews: { ...store.getState().editorViews } });
    const unsubscribe = store.subscribe((state) => state.derivedSnapshot, touchViews);
    touchViews();
    unsubscribe();
    expect(vi.getTimerCount()).toBe(1);
    const { namespaces } = store.getState();
    const beta = namespaces[NAMESPACE_IDS.BETA];
    const instance = beta.animationInstances[INSTANCE_IDS.BETA_SHARED];
    store.setState({
      namespaces: {
        ...namespaces,
        [NAMESPACE_IDS.BETA]: {
          ...beta,
          animationInstances: {
            ...beta.animationInstances,
            [INSTANCE_IDS.BETA_SHARED]: {
              ...instance,
              settings: { ...instance.settings, timescale: settings.timescale * 2 },
            },
          },
        },
      },
    });
    store.getState().playerStore.getState().resetPlayer(shownAt);

    const row = store.getState().instancedTrackSources[ROW];
    const { result } = renderHook(() => useKeyControlState(row), {
      wrapper: ({ children }: { children: ReactNode }) =>
        createElement(AnimationContext.Provider, { value: store }, children),
    });
    expect(result.current.keyState).toBe("full");
  } finally {
    vi.useRealTimers();
    cleanup?.();
  }
});
