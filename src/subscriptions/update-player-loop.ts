import { PlayerData, usePlayerStore } from "@semio/utils";
import { shallow } from "zustand/shallow";
import type { AnimationApi, AnimationStoreGetter, AnimationStoreSetter } from "../store-types";

export function updatePlayerLoop(
  _api: AnimationApi,
  set: AnimationStoreSetter,
  get: AnimationStoreGetter,
): () => void {
  const updatePlayerInner = usePlayerStore.getState().updatePlayer;

  const unsubscribe = usePlayerStore.subscribe(
    (state: PlayerData) => state.player.running,
    (running) => {
      const interval = get().playerInterval;
      if (interval) {
        window.clearInterval(interval);
      }

      if (running) {
        updatePlayerInner(true);
        const newInterval = window.setInterval(() => {
          updatePlayerInner(false);
        }, 25);
        set({ playerInterval: newInterval });
      }
    },
    { equalityFn: shallow, fireImmediately: true },
  );

  // Only this subscription stops the interval. Once the subscription is gone
  // nothing else would — a later pause reaches whichever store is still
  // subscribed — so teardown stops it too. The teardown runs once, as the
  // current set's (see `initAnimationSubscriptions`), so the store's interval
  // is this subscription's.
  return () => {
    unsubscribe();
    const interval = get().playerInterval;
    if (interval) {
      window.clearInterval(interval);
      set({ playerInterval: undefined });
    }
  };
}
