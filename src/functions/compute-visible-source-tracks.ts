import { GROUP_TYPES } from "../constants";
import { Source, SourceGroup, SourceTrack } from "../types";

interface ComputeVisibleSourceTracksOptions {
  includeHidden?: boolean;
  includeMuted?: boolean;
  hiddenSourceTrackIds?: Set<string>;
}

export function computeVisibleSourceTracks(
  sources: Source[],
  options: ComputeVisibleSourceTracksOptions = {},
): string[] {
  const includeHidden = options.includeHidden ?? false;
  const includeMuted = options.includeMuted ?? true;
  const hiddenSourceTrackIds = options.hiddenSourceTrackIds ?? new Set<string>();
  const openTracks = new Set<string>();
  if (!sources) {
    return [];
  }

  sources.forEach((source) => {
    if (GROUP_TYPES.has(source.type)) {
      const sourceGroup = source as SourceGroup;
      computeVisibleSourceTracks(sourceGroup.children, options).forEach((id) => {
        openTracks.add(id);
      });
    } else {
      const sourceTrack = source as SourceTrack;
      if (hiddenSourceTrackIds.has(sourceTrack.id) && !includeHidden) {
        return;
      }
      if (sourceTrack.muted && !includeMuted) {
        return;
      }
      const id = `${sourceTrack.namespaceId}/${sourceTrack.instanceId}/${sourceTrack.trackId}`;
      openTracks.add(id);
    }
  });
  return Array.from(openTracks);
}
