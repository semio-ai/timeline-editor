import { uniq } from "lodash";
import {
  LayerBand,
  type Source,
  type SourceGroup,
  type SourceRow,
  type SourceTrack,
} from "../types";
import { GROUP_TYPES } from "../constants";

// A utility function to convert a nested source structure into a flat list of rows.
// Each
export function computeSourceRowsFromSources(
  sources: Source[],
  activeAnimationInstance?: string | null,
  selectedTrackIds = new Set<string>(),
): SourceRow[] {
  const rows: SourceRow[] = [];

  if (!sources || sources.length === 0) return rows;

  sources.forEach((source: Source) => {
    if (GROUP_TYPES.has(source.type)) {
      // Get the list of SourceRows for the children;
      const sourceGroup = source as SourceGroup;
      const childRows = computeSourceRowsFromSources(
        sourceGroup.children,
        activeAnimationInstance,
        selectedTrackIds,
      );
      if (childRows.length === 0) return;
      // Compute the unique set of trackIds/attributes in the children;
      const data = uniq(childRows.flatMap((child) => child.data));
      // Add a row for the group itself
      rows.push({
        id: `${source.namespaceId}/${source.instanceId}/${sourceGroup.groupId}`,
        expanded: sourceGroup.expanded ?? undefined,
        name: sourceGroup.name,
        data,
      });
      // Add the child rows
      rows.push(...childRows);
    } else {
      // It is a leaf track, so just add it directly (as long as it isn't hidden);
      const sourceTrack = source as SourceTrack;
      if (sourceTrack.hidden) return;
      const foreground =
        !activeAnimationInstance || sourceTrack.instanceId === activeAnimationInstance;
      const namespacedTrackKey = `${sourceTrack.namespaceId}/${sourceTrack.instanceId}/${sourceTrack.trackId}`;
      const baseSelected =
        foreground &&
        (selectedTrackIds.has(sourceTrack.trackId) || selectedTrackIds.has(namespacedTrackKey));

      let mainBand: LayerBand;
      if (!foreground) {
        mainBand = LayerBand.Background;
      } else if (baseSelected) {
        mainBand = LayerBand.ForegroundSelected;
      } else {
        mainBand = LayerBand.ForegroundUnselected;
      }
      const layerBand = baseSelected ? LayerBand.ForegroundSelected : mainBand;

      rows.push({
        id: `${sourceTrack.namespaceId}/${sourceTrack.instanceId}/${sourceTrack.trackId}`,
        data: [
          {
            selectable: foreground,
            editable: !sourceTrack.readonly,
            layerBand,
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
