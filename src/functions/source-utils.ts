import { GROUP_TYPES } from "../constants";
import type { Source, SourceGroup, SourceTrack } from "../types";

export const collectSourceTracks = (
  sources: Source[],
  acc: SourceTrack[] = [],
): SourceTrack[] => {
  sources.forEach((source) => {
    if (GROUP_TYPES.has(source.type)) {
      collectSourceTracks((source as SourceGroup).children, acc);
    } else {
      acc.push(source as SourceTrack);
    }
  });
  return acc;
};

export const findSourceTrackById = (
  sources: Source[],
  id: string,
): SourceTrack | undefined => {
  for (const source of sources) {
    if (GROUP_TYPES.has(source.type)) {
      const found = findSourceTrackById((source as SourceGroup).children, id);
      if (found) {
        return found;
      }
    } else if (source.id === id) {
      return source as SourceTrack;
    }
  }
  return undefined;
};
