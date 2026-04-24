import { GROUP_TYPES } from "../constants";
import { Source, SourceGroup, SourceTrack } from "../types";

interface SourceUpdate {
  expanded?: boolean;
  muted?: boolean;
  visible?: boolean;
  locked?: boolean;
}

export function computeUpdatedSources(
  sources: Source[],
  updates: Record<string, SourceUpdate>,
): Source[] {
  return sources.map((source) => {
    if (GROUP_TYPES.has(source.type)) {
      const sourceGroup = source as SourceGroup;
      const update = updates[source.id];
      return {
        ...sourceGroup,
        expanded: update?.expanded !== undefined ? update.expanded! : sourceGroup.expanded,
        children: computeUpdatedSources(sourceGroup.children, updates),
      };
    } else {
      const sourceTrack = source as SourceTrack;
      const update = updates[source.id];
      if (!update) {
        return sourceTrack;
      }
      return {
        ...sourceTrack,
        muted: update.muted !== undefined ? update.muted : sourceTrack.muted,
        visible: update.visible !== undefined ? update.visible : sourceTrack.visible,
        locked: update.locked !== undefined ? update.locked : sourceTrack.locked,
      };
    }
  });
}
