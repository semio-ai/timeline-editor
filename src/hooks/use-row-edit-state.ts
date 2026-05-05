import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { uniq } from "lodash";
import {
  computeRowEditPredicates,
  deriveOwningEntityFromNamespaceId,
  type RowEditPredicates,
} from "../functions/row-edit-state";
import type { AnimationData } from "../store-types";
import type { SourceRow } from "../types";
import { useAnimationStore } from "./use-animation-store";

/**
 * React-side accessor for {@link computeRowEditPredicates}. Subscribes to the
 * store keys the predicates depend on, derives row-local inputs from
 * `sourceRow`, and returns the predicate set.
 *
 * Use this in any UI surface that decides "is this row active / selected /
 * editable" (sidebar widget, canvas overlays, row backgrounds). Avoids
 * re-deriving the same logic in three+ places with subtly-different gates.
 *
 * Selectors are split per store key (rather than one composite object) so
 * each component only re-renders when the specific input it depends on
 * changes — cheap during playback when most of these don't move.
 */
export function useRowEditState(
  sourceRow: SourceRow,
  options?: { nonEditable?: boolean },
): RowEditPredicates {
  const trackIds = useMemo(() => uniq(sourceRow.data.map((d) => d.trackId)), [sourceRow.data]);

  const rowInstanceId = useMemo(() => {
    const ids = uniq(
      sourceRow.data.map((d) => d.instanceId).filter((v): v is string => Boolean(v)),
    );
    return ids.length === 1 ? ids[0] : undefined;
  }, [sourceRow.data]);

  const owningEntityId = useMemo(() => {
    const ns = sourceRow.data.find((d) => d.namespaceId)?.namespaceId;
    return deriveOwningEntityFromNamespaceId(ns);
  }, [sourceRow.data]);

  const activeEntityId = useAnimationStore(
    useShallow((state: AnimationData) => state.activeEntityId),
  );
  const entityActiveInstanceIdForOwningEntity = useAnimationStore(
    useShallow((state: AnimationData) =>
      owningEntityId ? (state.entityStates[owningEntityId]?.activeInstanceId ?? null) : null,
    ),
  );
  const selectionInstanceId = useAnimationStore(
    useShallow((state: AnimationData) => state.selectionState.instanceId),
  );
  const selectedKeypoints = useAnimationStore(
    useShallow((state: AnimationData) => state.selectionState.keypoints),
  );

  // The hook avoids the broader entityStates record in its store read by
  // resolving the only entry the predicates need (the owning entity's active
  // instance) at the selector boundary. The shape passed to
  // computeRowEditPredicates rebuilds the minimal record the pure helper
  // expects.
  const entityStates = useMemo(
    () =>
      owningEntityId
        ? {
            [owningEntityId]: {
              controlMode: "animation" as const,
              activeInstanceId: entityActiveInstanceIdForOwningEntity,
            },
          }
        : {},
    [owningEntityId, entityActiveInstanceIdForOwningEntity],
  );

  return useMemo(
    () =>
      computeRowEditPredicates({
        owningEntityId,
        rowInstanceId,
        trackIds,
        nonEditable: options?.nonEditable,
        activeEntityId,
        entityStates,
        selectionInstanceId,
        selectedKeypoints,
      }),
    [
      owningEntityId,
      rowInstanceId,
      trackIds,
      options?.nonEditable,
      activeEntityId,
      entityStates,
      selectionInstanceId,
      selectedKeypoints,
    ],
  );
}
