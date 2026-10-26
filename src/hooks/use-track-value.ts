import { useCallback, useContext, useSyncExternalStore } from "react";
import { AnimationContext } from "../context";
import { trackValueAt } from "../functions/track-value-at";
import type { SimpleRawValue } from "../types/data/simple-track";

/**
 * The value a track takes at the playhead (`trackValueAt` of the derived
 * snapshot at the player's stamp). The component re-renders when that value
 * changes, not at each player tick nor at each rebuild of the snapshot (a
 * selection, a drag move elsewhere): the value is a scalar, compared as such.
 */
export function useTrackValue(trackKey: string): SimpleRawValue | undefined {
  const store = useContext(AnimationContext);
  if (!store) throw new Error("Missing AnimationProvider in the tree");
  const player = store.getState().playerStore;
  const subscribe = useCallback(
    (notify: () => void) => {
      const stopStore = store.subscribe(notify);
      const stopPlayer = player.subscribe(notify);
      return () => {
        stopStore();
        stopPlayer();
      };
    },
    [store, player],
  );
  return useSyncExternalStore(subscribe, () =>
    trackValueAt(store.getState().derivedSnapshot, trackKey, player.getState().player.stamp),
  );
}
