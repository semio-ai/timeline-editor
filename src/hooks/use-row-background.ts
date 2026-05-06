import { useMemo } from "react";
import { uniq } from "lodash";
import { DEFAULT_COLOR } from "../constants";
import type { SourceRow } from "../types";
import { useColors } from "./use-colors";
import { useRowEditState } from "./use-row-edit-state";

/**
 * Shared row-background computation for track-backed rows. Produces a color
 * string with embedded alpha for the full-row tint:
 *   - 40% (`${color}40`): row has at least one selected keypoint
 *   - 33% (`${color}33`): row is in the selection map but no keypoints picked
 *   - 26% (`${color}26`): hover (emphasis)
 *   - 00% (`${color}00`): none of the above (kept as a valid color string so
 *     CSS transitions still animate alpha changes smoothly)
 *
 * The base color falls back to `DEFAULT_COLOR` when the row is not a
 * rig-driving instance for its owning entity (per
 * {@link useRowEditState}'s `isActiveDriverForOwningEntity`). Visually
 * de-emphasizes rows that aren't part of any active animation.
 *
 * Used by both `TrackControl` and `AnimatableGroupControl` so a selected
 * key highlights identically regardless of which list is rendering the row.
 */
export function useRowBackground(params: {
  sourceRow: SourceRow;
  /** Whether the pointer is hovering this row (drives the emphasis tint). */
  emphasis: boolean;
  /** When true, suppresses the row color to DEFAULT_COLOR regardless of
   *  activity — useful for playing / disabled states. */
  forceDefaultColor?: boolean;
}): string {
  const { sourceRow, emphasis, forceDefaultColor = false } = params;

  const trackIds = useMemo(() => uniq(sourceRow.data.map((d) => d.trackId)), [sourceRow.data]);
  const trueColor = useColors(trackIds);
  const predicates = useRowEditState(sourceRow);

  return useMemo(() => {
    // Base color: rig-driving (any entity's active) shows in color; non-active
    // shows in default. Rows without a unique instance (mixed aggregates)
    // fall through to active so they aren't grayed out.
    const baseInColor = predicates.isActiveDriverForOwningEntity || trackIds.length === 0;
    const bgColor = baseInColor && !forceDefaultColor ? trueColor : DEFAULT_COLOR;
    if (predicates.hasSelectedKeys) return `${bgColor}40`;
    if (predicates.isInSelection) return `${bgColor}33`;
    if (emphasis) return `${bgColor}26`;
    return `${bgColor}00`;
  }, [
    predicates.isActiveDriverForOwningEntity,
    predicates.hasSelectedKeys,
    predicates.isInSelection,
    trackIds.length,
    forceDefaultColor,
    trueColor,
    emphasis,
  ]);
}
