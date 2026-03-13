import { GROUP_TYPES } from "../constants";
import { Source, SourceGroup, SourceTrack } from "../types";

export function computeUpdatedSources(
  sources: Source[],
  updates: Record<string, { hidden?: boolean; expanded?: boolean; muted?: boolean }>,
): Source[] {
  return sources.map((source) => {
    if (GROUP_TYPES.has(source.type)) {
      const sourceGroup = source as SourceGroup;
      const updateExpanded = updates[source.id]?.expanded !== undefined;
      return {
        ...sourceGroup,
        expanded: updateExpanded ? updates[source.id].expanded! : sourceGroup.expanded,
        // Recursively process the group's children
        children: computeUpdatedSources(sourceGroup.children, updates),
      };
    } else {
      const sourceTrack = source as SourceTrack;
      const updateMuted = updates[source.id]?.muted !== undefined;
      if (!updateMuted) {
        return sourceTrack;
      } else {
        return {
          ...sourceTrack,
          muted: updateMuted ? updates[source.id].muted! : sourceTrack.muted,
        };
      }
    }
  });
}
