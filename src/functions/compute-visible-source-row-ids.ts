import type { Source, SourceGroup, SourceTrack, VisibleSourceRowIds } from "../types";
import { GROUP_TYPES } from "../constants";

interface ComputeVisibleSourceRowIdsOptions {
  hiddenSourceTrackIds?: Set<string>;
}

/**
 * Computes both the flat (groups + leaves) and spline (leaf-only) lists of source row IDs.
 *
 * - `flat`: Respects group expanded/collapsed state. Collapsed groups appear but their
 *   children do not. Used for track list row ordering.
 * - `spline`: Always includes ALL non-hidden leaf tracks regardless of collapse state.
 *   Used for canvas rendering and the filtered global row. Collapsing a group in the
 *   track list should not remove its tracks from the canvas/timeline.
 */
export function computeVisibleSourceRowIds(
  sources: Source[],
  options: ComputeVisibleSourceRowIdsOptions = {},
): VisibleSourceRowIds {
  const accumulator: VisibleSourceRowIds = { flat: [], spline: [] };

  if (!sources || sources.length === 0) {
    return accumulator;
  }

  const hiddenIds = options.hiddenSourceTrackIds ?? new Set<string>();
  collectIds(sources, accumulator, hiddenIds);
  return accumulator;
}

function collectIds(
  sources: Source[],
  acc: VisibleSourceRowIds,
  hiddenSourceTrackIds: Set<string>,
  collapsed = false,
): void {
  sources.forEach((source: Source) => {
    if (GROUP_TYPES.has(source.type)) {
      const sourceGroup = source as SourceGroup;
      const isOrgGroup = sourceGroup.type === "entity" || sourceGroup.type === "instance";

      if (!collapsed) {
        // Group appears in flat list (track list) unless a parent is collapsed
        acc.flat.push(sourceGroup.id);
      }

      // Recurse into children. If this group is collapsed, pass collapsed=true
      // so descendants are excluded from `flat` but still included in `spline`.
      const childCollapsed = collapsed || !sourceGroup.expanded;
      collectIds(sourceGroup.children, acc, hiddenSourceTrackIds, childCollapsed);
    } else {
      const sourceTrack = source as SourceTrack;
      if (hiddenSourceTrackIds.has(sourceTrack.id)) return;

      const trackId = `${sourceTrack.namespaceId}/${sourceTrack.instanceId}/${sourceTrack.trackId}`;

      // Spline list: always includes all non-hidden tracks (canvas rendering)
      acc.spline.push(trackId);

      // Flat list: only includes tracks whose parent groups are all expanded
      if (!collapsed) {
        acc.flat.push(trackId);
      }
    }
  });
}
