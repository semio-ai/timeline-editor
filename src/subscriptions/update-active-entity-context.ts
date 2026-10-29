import { namespaceEntity } from "@semio/data";
import { shallow } from "zustand/shallow";
import type {
  ActiveEntityContext,
  AnimationApi,
  AnimationData,
  AnimationStoreGetter,
  AnimationStoreSetter,
} from "../store-types";

/** Shallow-compare two contexts, treating instanceIds arrays as equal if they have the same elements. */
function contextEqual(a: ActiveEntityContext | null, b: ActiveEntityContext | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.entityId === b.entityId &&
    a.namespaceId === b.namespaceId &&
    a.controlMode === b.controlMode &&
    a.activeInstanceId === b.activeInstanceId &&
    a.instanceIds.length === b.instanceIds.length &&
    a.instanceIds.every((id, i) => id === b.instanceIds[i])
  );
}

/**
 * Derives `activeEntityContext` from `activeEntityId`, `entityStates`, and `namespaces`.
 * Sets the result on the store so consumers can read it directly.
 * Skips the write when the derived context is structurally identical to the current one.
 */
export function updateActiveEntityContext(
  api: AnimationApi,
  set: AnimationStoreSetter,
  get: AnimationStoreGetter,
): () => void {
  return api.subscribe(
    (state: AnimationData) => ({
      activeEntityId: state.activeEntityId,
      entityStates: state.entityStates,
      namespaces: state.namespaces,
    }),
    ({ activeEntityId, entityStates, namespaces }) => {
      const current = get().activeEntityContext;

      if (!activeEntityId) {
        if (current !== null) set({ activeEntityContext: null });
        return;
      }

      const namespaceEntry = Object.entries(namespaces).find(
        ([id]) => namespaceEntity(id) === activeEntityId,
      );
      if (!namespaceEntry) {
        if (current !== null) set({ activeEntityContext: null });
        return;
      }

      const [namespaceId, namespace] = namespaceEntry;
      const entityState = entityStates[activeEntityId];
      const controlMode = entityState?.controlMode ?? "direct";
      const activeInstanceId = entityState?.activeInstanceId ?? null;
      const instanceIds = Object.keys(namespace.animationInstances ?? {});

      const next: ActiveEntityContext = {
        entityId: activeEntityId,
        namespaceId,
        controlMode,
        activeInstanceId,
        instanceIds,
      };

      if (!contextEqual(current, next)) {
        set({ activeEntityContext: next });
      }
    },
    { fireImmediately: true, equalityFn: shallow },
  );
}
