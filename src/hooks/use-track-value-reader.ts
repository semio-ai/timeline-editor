import { useCallback, useContext } from "react";
import { AnimationContext } from "../context";
import { trackValueAt } from "../functions/track-value-at";
import type { SimpleRawValue } from "../types/data/simple-track";

/**
 * A reader of the value a track takes at a world stamp, from the store's
 * derived snapshot as it is when the reader is called (`trackValueAt`): for
 * event handlers, which read it once, so the component does not re-render as
 * the snapshot changes.
 */
export function useTrackValueReader(): (
  trackKey: string,
  worldStamp: number,
) => SimpleRawValue | undefined {
  const store = useContext(AnimationContext);
  if (!store) throw new Error("Missing AnimationProvider in the tree");
  return useCallback(
    (trackKey, worldStamp) => trackValueAt(store.getState().derivedSnapshot, trackKey, worldStamp),
    [store],
  );
}
