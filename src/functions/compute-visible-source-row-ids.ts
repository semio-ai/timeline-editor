import type { Source, SourceGroup, SourceTrack } from "../types";
import { GROUP_TYPES } from "../constants";

/**
 * Computes the list of visible source row IDs based on the expanded state of groups.
 * Groups are always visible, but their children are only visible when the group is expanded.
 *
 * @param sources - The source tree to process
 * @returns Array of visible source row IDs
 */
export function computeVisibleSourceRowIds(sources: Source[]): string[] {
  const visibleIds: string[] = [];

  if (!sources || sources.length === 0) return visibleIds;

  sources.forEach((source: Source) => {
    if (GROUP_TYPES.has(source.type)) {
      const sourceGroup = source as SourceGroup;
      // The group itself is always visible
      const groupId = `${source.namespaceId}/${source.instanceId}/${sourceGroup.groupId}`;
      visibleIds.push(groupId);

      // Only process children if the group is expanded
      if (sourceGroup.expanded) {
        // Recursively get visible IDs from children
        const childIds = computeVisibleSourceRowIds(sourceGroup.children);
        visibleIds.push(...childIds);
      }
    } else {
      // It's a leaf track - add it if not hidden
      const sourceTrack = source as SourceTrack;
      if (!sourceTrack.hidden) {
        const trackId = `${sourceTrack.namespaceId}/${sourceTrack.instanceId}/${sourceTrack.trackId}${
          sourceTrack.attribute ? `.${sourceTrack.attribute}` : ""
        }`;
        visibleIds.push(trackId);
      }
    }
  });

  return visibleIds;
}
