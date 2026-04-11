import { uniq } from "lodash";
import {
  LayerBand,
  type Source,
  type SourceGroup,
  type SourceRow,
  type SourceTrack,
} from "../types";
import { GROUP_TYPES } from "../constants";

/**
 * Converts a nested source structure into a flat list of rows with depth tracking.
 * Each group emits a group row followed by its child rows. Depth, sibling position,
 * and parent ID are set on each row to support tree rendering.
 */
export function computeSourceRowsFromSources(
  sources: Source[],
  activeAnimationInstance?: string | null,
  selectedTrackIds = new Set<string>(),
  depth = 0,
  parentId?: string,
): SourceRow[] {
  const rows: SourceRow[] = [];

  if (!sources || sources.length === 0) return rows;

  // Count how many sources will produce rows (for isLastChild tracking)
  const sourceCount = sources.length;

  sources.forEach((source: Source, sourceIndex: number) => {
    const isLastChild = sourceIndex === sourceCount - 1;

    if (GROUP_TYPES.has(source.type)) {
      const sourceGroup = source as SourceGroup;
      const groupId = `${source.namespaceId}/${source.instanceId}/${sourceGroup.groupId}`;
      const childRows = computeSourceRowsFromSources(
        sourceGroup.children,
        activeAnimationInstance,
        selectedTrackIds,
        depth + 1,
        groupId,
      );
      if (childRows.length === 0) return;

      const data = uniq(childRows.flatMap((child) => child.data));

      rows.push({
        id: groupId,
        expanded: sourceGroup.expanded ?? undefined,
        name: sourceGroup.name,
        data,
        depth,
        isLastChild,
        isGroup: true,
        parentId,
      });

      rows.push(...childRows);
    } else {
      const sourceTrack = source as SourceTrack;
      const foreground =
        Boolean(activeAnimationInstance) && sourceTrack.instanceId === activeAnimationInstance;
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
        id: namespacedTrackKey,
        data: [
          {
            selectable: foreground,
            editable: !sourceTrack.readonly,
            layerBand,
            type: sourceTrack.type,
            muted: sourceTrack.muted,
            animationId: sourceTrack.animationId,
            namespaceId: sourceTrack.namespaceId,
            instanceId: sourceTrack.instanceId,
            trackId: sourceTrack.trackId,
            animatableId: sourceTrack.animatableId,
          },
        ],
        depth,
        isLastChild,
        isGroup: false,
        parentId,
      });
    }
  });

  return rows;
}
