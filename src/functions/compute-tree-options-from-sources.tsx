import { TreeOption } from "@semio/ui";
import { Source, SourceGroup, SourceTrack } from "../types";
import { DataIcon } from "../components/data-icon";
import { GROUP_TYPES } from "../constants";

export function computeTreeOptionsFromSources(
  sources: Source[],
  nameLookup: Record<string, string>,
): TreeOption[] {
  if (!sources || sources.length === 0) return [];

  return sources.map((source) => {
    if (GROUP_TYPES.has(source.type)) {
      const sourceGroup = source as SourceGroup;
      const option: TreeOption = {
        value: sourceGroup.id,
        label: sourceGroup.name || "Unnamed Group",
        children: computeTreeOptionsFromSources(sourceGroup.children, nameLookup),
        icon: <DataIcon iconCode={sourceGroup.iconCode ?? "group"} />,
      };
      return option;
    } else {
      const sourceTrack = source as SourceTrack;
      return {
        value: sourceTrack.id,
        label: sourceTrack.attribute ? sourceTrack.attribute : nameLookup[sourceTrack.trackId],
        icon: <DataIcon iconCode={sourceTrack.iconCode ?? ""} />,
      };
    }
  });
}
