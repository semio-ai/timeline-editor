import { PlayerData, usePlayerStore } from "@semio/utils";
import { shallow } from "zustand/shallow";
import { AnimationStoreGetter, AnimationStoreSetter } from "../store-types";
import { AnimationApi } from "../store";

export function updatePlayerLoop(
  _api: AnimationApi,
  set: AnimationStoreSetter,
  get: AnimationStoreGetter,
): () => void {
  const updatePlayerInner = usePlayerStore.getState().updatePlayer;

  return usePlayerStore.subscribe(
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
    { equalityFn: shallow },
  );
}
