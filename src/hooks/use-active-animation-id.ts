import type { AnimationData } from "../store-types";
import { useAnimationStore } from "./use-animation-store";

/**
 * Resolves the animation id associated with the currently selected instance.
 * Walks namespaces to find the entry for `selectionState.instanceId` and
 * returns its `animationId`. Returns `undefined` when nothing is selected
 * or the instance is not present in any namespace.
 */
export function useActiveAnimationId(): string | undefined {
  return useAnimationStore((state: AnimationData) => {
    const selectionInstanceId = state.selectionState.instanceId;
    if (!selectionInstanceId) return undefined;
    for (const namespace of Object.values(state.namespaces)) {
      const instance = namespace.animationInstances[selectionInstanceId];
      if (instance) return instance.animationId;
    }
    return undefined;
  });
}
