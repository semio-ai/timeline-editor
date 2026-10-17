import { useStore } from "zustand";
import type { PlayerActions, PlayerData } from "@semio/utils";
import { useAnimationStore } from "./use-animation-store";

/**
 * Reads the player of the animation store in context: the playhead, bounds
 * and transport the timeline shows and commands (`AnimationData.playerStore`).
 * Must be used within an AnimationProvider.
 *
 * @param selector - A function that takes the player's state and returns the value you want to access.
 * @returns The value returned by the selector.
 */
export function usePlayer<T>(selector: (state: PlayerData & PlayerActions) => T): T {
  return useStore(
    useAnimationStore((state) => state.playerStore),
    selector,
  );
}
