import type { Source, SourceGroup, SourceTrack, VisibleSourceRowIds } from "../types";
import { GROUP_TYPES } from "../constants";

interface ComputeVisibleSourceRowIdsOptions {
  hiddenSourceTrackIds?: Set<string>;
}

/**
 * Computes both the flat (groups + leaves) and spline (leaf-only) lists of source row IDs
 * based on the expanded state of groups. Groups are always included in the flat list, but
 * only expanded groups contribute their children to either list.
 */
export function computeVisibleSourceRowIds(
  sources: Source[],
  options: ComputeVisibleSourceRowIdsOptions = {},
): VisibleSourceRowIds {
  const accumulator: VisibleSourceRowIds = { flat: [], spline: [] };

  if (!sources || sources.length === 0) {
    return accumulator;
  }

  collectVisibleIds(sources, accumulator, options.hiddenSourceTrackIds ?? new Set<string>());
  return accumulator;
}

function collectVisibleIds(
  sources: Source[],
  acc: VisibleSourceRowIds,
  hiddenSourceTrackIds: Set<string>,
): void {
  sources.forEach((source: Source) => {
    if (GROUP_TYPES.has(source.type)) {
      const sourceGroup = source as SourceGroup;
      const isOrgGroup = sourceGroup.type === "entity" || sourceGroup.type === "instance";

      // Entity/instance groups are organizational — they don't have entries
      // in instancedTrackSources, so they shouldn't appear in sourceRowIds.
      // Their children are included directly (the org group is transparent).
      if (isOrgGroup) {
        // Always recurse into org groups (they don't have expand/collapse yet
        // at the sourceRowIds level — that's handled by the track list UI).
        collectVisibleIds(sourceGroup.children, acc, hiddenSourceTrackIds);
      } else {
        acc.flat.push(sourceGroup.id);
        if (sourceGroup.expanded) {
          collectVisibleIds(sourceGroup.children, acc, hiddenSourceTrackIds);
        }
      }
    } else {
      const sourceTrack = source as SourceTrack;
      if (hiddenSourceTrackIds.has(sourceTrack.id)) return;

      const trackId = `${sourceTrack.namespaceId}/${sourceTrack.instanceId}/${sourceTrack.trackId}`;

      acc.flat.push(trackId);
      acc.spline.push(trackId);
    }
  });
}
