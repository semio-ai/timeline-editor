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
      const updateHidden = updates[source.id]?.hidden !== undefined;
      const updateMuted = updates[source.id]?.muted !== undefined;
      if (!updateHidden && !updateMuted) {
        return sourceTrack;
      } else {
        return {
          ...sourceTrack,
          hidden: updateHidden ? updates[source.id].hidden! : sourceTrack.hidden,
          muted: updateMuted ? updates[source.id].muted! : sourceTrack.muted,
        };
      }
    }
  });
}
