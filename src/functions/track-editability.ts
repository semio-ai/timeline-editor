import type { SourceRow } from "../types";

/**
 * Two distinct flags can mark a track as non-editable:
 *
 *   - `locked`: a user-initiated toggle. Visible in the UI as a lock and
 *     freely toggleable when not also `readonly`.
 *   - `readonly`: a document-permission flag. The current user lacks edit
 *     permission on the loaded animation document; the lock is enforced by
 *     the system and cannot be cleared from the editor.
 *
 * Both flags produce the same gating effect on authoring mutations — every
 * mutation action that modifies track contents must consult
 * `nonEditableIds` (the union) before applying changes.
 *
 * Returning the partitioned sets lets callers also distinguish "why" when
 * useful (e.g. tooltips, future per-source diagnostics).
 */
export interface NonEditableTrackIds {
  /** Tracks blocked because the user toggled them locked. */
  lockedIds: Set<string>;
  /** Tracks blocked because the document permits no edits. */
  readonlyIds: Set<string>;
  /** Union — every track that should reject authoring mutations. */
  nonEditableIds: Set<string>;
}

export function getNonEditableTrackIds(
  sourceRows: Record<string, SourceRow>,
): NonEditableTrackIds {
  const lockedIds = new Set<string>();
  const readonlyIds = new Set<string>();
  const nonEditableIds = new Set<string>();
  Object.values(sourceRows).forEach((row) =>
    row.data.forEach((d) => {
      if (d.locked) {
        lockedIds.add(d.trackId);
        nonEditableIds.add(d.trackId);
      }
      if (d.readonly) {
        readonlyIds.add(d.trackId);
        nonEditableIds.add(d.trackId);
      }
    }),
  );
  return { lockedIds, readonlyIds, nonEditableIds };
}
