import { useCallback, useContext } from "react";
import { AnimationContext } from "../context";
import { trackValueAt } from "../functions/track-value-at";
import { currentDerivedSnapshot } from "../subscriptions/init-derived-orchestrator";
import type { SimpleRawValue } from "../types/data/simple-track";

/**
 * A reader of the value a track takes at a world stamp, from the derived
 * snapshot for the store's state when the reader is called
 * (`currentDerivedSnapshot`, `trackValueAt`): for event handlers, which read
 * it once and act on it, so the component does not re-render as the snapshot
 * changes, and an edit never takes a value from a snapshot that trails the
 * state.
 */
export function useTrackValueReader(): (
  trackKey: string,
  worldStamp: number,
) => SimpleRawValue | undefined {
  const store = useContext(AnimationContext);
  if (!store) throw new Error("Missing AnimationProvider in the tree");
  return useCallback(
    (trackKey, worldStamp) =>
      trackValueAt(currentDerivedSnapshot(store.getState()), trackKey, worldStamp),
    [store],
  );
}
