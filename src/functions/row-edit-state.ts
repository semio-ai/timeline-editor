import type { EntityAnimationState } from "../store-types";

/**
 * Single source of truth for "what's the editing/visual state of this row?"
 *
 * Background: row visuals (canvas color tier, sidebar tint, left-edge bar,
 * selectability, etc.) used to be re-derived independently in three+ places
 * with subtle differences, leading to bleed and desync bugs (e.g. selecting
 * in one entity highlighting tracks in another that share a trackId).
 * Everything that decides "is this row active / selected / editable" should
 * route through {@link computeRowEditPredicates}.
 *
 * Concept model (kept aligned by the writers in `actions/selection.ts` and
 * the studio's `entity-actions`):
 *
 * - **`activeEntityId`** — the editor's currently focused entity.
 * - **`entityStates[entityId].activeInstanceId`** — the per-entity active
 *   animation instance (the rig driver for that entity).
 * - **"Actively edited instance"** is *derived*: it's
 *   `entityStates[activeEntityId]?.activeInstanceId`. There is intentionally
 *   no separate stored field for it. `selectionState.instanceId` is a
 *   strict mirror of this derivation, kept in sync by every writer.
 *
 * From those, per-row predicates fall out cleanly:
 *
 * - `isActiveDriverForOwningEntity` — row's instance == its entity's active
 *   instance. This is the "show in color" axis. Drives canvas foreground vs
 *   background and sidebar widget color, regardless of focus.
 * - `isFocusedEntity` — row's entity == `activeEntityId`. Restricts
 *   interactivity (only the focused entity is editable from the editor).
 * - `isCurrentlyEdited` — row is the actually-editable row: focused entity's
 *   active instance, not locked. The "editable foreground" tier.
 * - `isInSelectionScope` — row's instance == selection scope (the mirror).
 *   Equivalent to `isFocusedEntity && isActiveDriverForOwningEntity` after
 *   writer consolidation, but kept as a separate predicate so a future
 *   change can re-decouple them without touching readers.
 * - `isInSelection` / `hasSelectedKeys` — selection map matches AND row is
 *   in scope. The scope guard prevents shared-trackId bleed across entities.
 */
export interface RowEditPredicates {
  isActiveDriverForOwningEntity: boolean;
  isFocusedEntity: boolean;
  isCurrentlyEdited: boolean;
  isInSelectionScope: boolean;
  isInSelection: boolean;
  hasSelectedKeys: boolean;
}

export interface RowEditInputs {
  /** Row's owning entity, derived from its namespaceId (`entityId@...`). */
  owningEntityId: string | undefined;
  /** Row's animation instance, when all entries in the row share one instance. */
  rowInstanceId: string | undefined;
  /** Leaf trackIds in the row (or aggregated descendant trackIds for groups). */
  trackIds: readonly string[];
  /** Row is non-editable (locked or readonly). For groups: aggregate. */
  nonEditable?: boolean;
  /** Editor's currently-focused entity. */
  activeEntityId: string | null;
  /** Per-entity animation state (controlMode + activeInstanceId). */
  entityStates: Record<string, EntityAnimationState>;
  /** Editor's selection scope — kept in sync with the derivation. */
  selectionInstanceId: string | null;
  /** Currently-selected keypoints, keyed by trackId. */
  selectedKeypoints: ReadonlyMap<string, ReadonlySet<string>>;
}

export function computeRowEditPredicates(inputs: RowEditInputs): RowEditPredicates {
  const {
    owningEntityId,
    rowInstanceId,
    trackIds,
    nonEditable = false,
    activeEntityId,
    entityStates,
    selectionInstanceId,
    selectedKeypoints,
  } = inputs;

  const entityActiveInstanceId = owningEntityId
    ? (entityStates[owningEntityId]?.activeInstanceId ?? null)
    : null;
  const isActiveDriverForOwningEntity =
    rowInstanceId !== undefined &&
    entityActiveInstanceId !== null &&
    rowInstanceId === entityActiveInstanceId;
  const isFocusedEntity =
    activeEntityId !== null && owningEntityId !== undefined && owningEntityId === activeEntityId;
  const isCurrentlyEdited = isFocusedEntity && isActiveDriverForOwningEntity && !nonEditable;
  const isInSelectionScope =
    rowInstanceId !== undefined && rowInstanceId === selectionInstanceId;
  const isInSelection = isInSelectionScope && trackIds.some((id) => selectedKeypoints.has(id));
  const hasSelectedKeys =
    isInSelectionScope &&
    trackIds.some((id) => (selectedKeypoints.get(id)?.size ?? 0) > 0);

  return {
    isActiveDriverForOwningEntity,
    isFocusedEntity,
    isCurrentlyEdited,
    isInSelectionScope,
    isInSelection,
    hasSelectedKeys,
  };
}

/**
 * Three-tier visual layer for a row, derived from the predicates. The
 * `update-instanced-track-sources` subscription maps this to the existing
 * `LayerBand` enum (which also encodes selection/locked nuances).
 */
export type RowLayer = "editable" | "locked" | "background";

export function computeRowLayer(predicates: RowEditPredicates): RowLayer {
  if (predicates.isCurrentlyEdited) return "editable";
  if (predicates.isActiveDriverForOwningEntity) return "locked";
  return "background";
}

/**
 * Row-level helper to derive the owning entity from a SourceRow's first
 * data entry's namespaceId. Returns undefined when the row has no data
 * (shouldn't happen for non-empty rows; defensive).
 */
export function deriveOwningEntityFromNamespaceId(
  namespaceId: string | undefined,
): string | undefined {
  if (!namespaceId) return undefined;
  return namespaceId.split("@")[0];
}
