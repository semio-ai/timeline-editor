import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { uniq } from "lodash";
import { DEFAULT_COLOR } from "../constants";
import type { AnimationData } from "../store-types";
import type { SourceRow } from "../types";
import { useAnimationStore } from "./use-animation-store";
import { useColors } from "./use-colors";

/**
 * Shared row-background computation for track-backed rows. Produces a color
 * string with embedded alpha that drives the full-row tint for:
 *   - 40% (`${color}40`): at least one keypoint selected on a track in this row
 *   - 33% (`${color}33`): track is in the selection map but no keypoints are picked
 *   - 26% (`${color}26`): hovered (emphasis)
 *   - 00% (`${color}00`): none of the above (kept as a valid color for CSS
 *     transition — same hex, zero alpha)
 *
 * The base color falls back to `DEFAULT_COLOR` when the row's unique instance
 * does not match the active selection instance (inactive row), which visually
 * de-emphasizes rows that aren't part of the current editing context.
 *
 * Used by both `TrackControl` and `AnimatableGroupControl` so a selected key
 * highlights identically regardless of which list is rendering the row.
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

  const { selectedKeypoints, selectionInstanceId } = useAnimationStore(
    useShallow((state: AnimationData) => ({
      selectedKeypoints: state.selectionState.keypoints,
      selectionInstanceId: state.selectionState.instanceId,
    })),
  );

  // Row is "active" only when all entries share one instance and that instance
  // matches the current selection instance. Rows with no unique instance (e.g.
  // mixed-instance aggregates) are treated as active so they aren't grayed out.
  const uniqueInstanceId = useMemo(() => {
    const ids = uniq(
      sourceRow.data.map((d) => d.instanceId).filter((v): v is string => Boolean(v)),
    );
    return ids.length === 1 ? ids[0] : undefined;
  }, [sourceRow.data]);
  const isActive = !uniqueInstanceId || selectionInstanceId === uniqueInstanceId;

  const trueColor = useColors(trackIds);

  // "Any track in selection map" vs "any track has selected keys" are distinct
  // tiers: selecting a track without picking keypoints (a bare track select)
  // falls into the middle tier.
  const isTrackInSelection = useMemo(
    () => trackIds.some((id) => selectedKeypoints.has(id)),
    [trackIds, selectedKeypoints],
  );
  const hasSelectedKeys = useMemo(
    () => trackIds.some((id) => (selectedKeypoints.get(id)?.size ?? 0) > 0),
    [trackIds, selectedKeypoints],
  );

  return useMemo(() => {
    const bgColor = isActive && !forceDefaultColor ? trueColor : DEFAULT_COLOR;
    if (hasSelectedKeys) return `${bgColor}40`;
    if (isTrackInSelection) return `${bgColor}33`;
    if (emphasis) return `${bgColor}26`;
    return `${bgColor}00`;
  }, [isActive, forceDefaultColor, trueColor, hasSelectedKeys, isTrackInSelection, emphasis]);
}
