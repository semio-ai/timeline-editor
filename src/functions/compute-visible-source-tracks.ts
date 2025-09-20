import { GROUP_TYPES } from "../constants";
import { Source, SourceGroup, SourceTrack } from "../types";

export function computeVisibleSourceTracks(sources: Source[]): string[] {
  const openTracks = new Set<string>();
  sources.forEach((source) => {
    if (GROUP_TYPES.has(source.type)) {
      const sourceGroup = source as SourceGroup;
      computeVisibleSourceTracks(sourceGroup.children).forEach((id) => {
        openTracks.add(id);
      });
    } else {
      const sourceTrack = source as SourceTrack;
      if (!sourceTrack.hidden) {
        const id = `${sourceTrack.namespaceId}/${sourceTrack.instanceId}/${sourceTrack.trackId}${sourceTrack.attribute ? `/${sourceTrack.attribute}` : ""}`;
        openTracks.add(id);
      }
    }
  });
  return Array.from(openTracks);
}
