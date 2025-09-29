import { uniq } from "lodash";
import type { Source, SourceGroup, SourceRow, SourceTrack } from "../types";
import { GROUP_TYPES } from "../constants";

// A utility function to convert a nested source structure into a flat list of rows.
// Each
export function computeSourceRowsFromSources(sources: Source[]): SourceRow[] {
  const rows: SourceRow[] = [];

  if (!sources || sources.length === 0) return rows;

  sources.forEach((source: Source) => {
    if (GROUP_TYPES.has(source.type)) {
      // Get the list of SourceRows for the children;
      const childRows = computeSourceRowsFromSources((source as SourceGroup).children);
      if (childRows.length === 0) return;
      // Compute the unique set of trackIds/attributes in the children;
      const data = uniq(childRows.flatMap((child) => child.data));
      // Add a row for the group itself
      rows.push({
        id: `${source.namespaceId}/${source.instanceId}/${(source as SourceGroup).groupId}`,
        expanded: (source as SourceGroup).expanded ?? undefined,
        data,
      });
      // Add the child rows
      rows.push(...childRows);
    } else {
      // It is a leaf track, so just add it directly (as long as it isn't hidden);
      const sourceTrack = source as SourceTrack;
      if (sourceTrack.hidden) return;
      rows.push({
        id: `${sourceTrack.namespaceId}/${sourceTrack.instanceId}/${sourceTrack.trackId}${sourceTrack.attribute ? `/${sourceTrack.attribute}` : ""}`,
        data: [
          {
            foreground: true,
            selectable: true,
            editable: !sourceTrack.readonly,
            type: sourceTrack.type,
            animationId: sourceTrack.animationId,
            namespaceId: sourceTrack.namespaceId,
            instanceId: sourceTrack.instanceId,
            trackId: sourceTrack.trackId,
            animatableId: sourceTrack.animatableId,
            attribute: sourceTrack.attribute,
          },
        ],
      });
    }
  });

  return rows;
}
