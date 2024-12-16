import { useRef, useCallback } from "react";
import { shallow } from "zustand/shallow";
import { PlayerData } from "@semio/utils";
import { usePlayerSubscription } from "./use-player-subscription";

/**
 * A hook used to retrieve a function that provides the current bounds to a provided function.
 * @returns A function that provides the current bounds to a function argument.
 */
export function useWithBounds(): (withBoundsFn: (bounds: [number, number]) => void) => void {
  const bounds = useRef<[number, number]>([0, 1]);

  const callback = useCallback(
    (currentBounds: [number, number]) => {
      bounds.current = currentBounds;
    },
    [bounds],
  );

  usePlayerSubscription((state: PlayerData) => state.player.bounds, callback, shallow);

  const withBounds = useCallback(
    (withBoundsFn: (bounds: [number, number]) => void) => {
      withBoundsFn(bounds.current);
    },
    [bounds],
  );

  return withBounds;
}
