import { isEqual } from "lodash";
import type {
  AnimationApi,
  AnimationData,
  AnimationStoreGetter,
  AnimationStoreSetter,
} from "../store-types";
import { LayerBand, Source, SourceGroup, SourceRow, SourceRowData, SourceTrack } from "../types";
import { GROUP_TYPES } from "../constants";

/**
 * Derives the flat `instancedTrackSources` dictionary from the canonical
 * `globalSourceTree`. Decorates each source with rendering
 * state (layerBand, selectable, editable) and flattens into a lookup keyed
 * by row ID.
 *
 * This subscription does NOT re-derive grouping — it walks the Source[] tree
 * that `updateGlobalSources` already computed via `computeDefaultSourcesFromInstance`.
 */
export function updateInstancedTrackSources(
  api: AnimationApi,
  set: AnimationStoreSetter,
  get: AnimationStoreGetter,
): () => void {
  return api.subscribe(
    (state: AnimationData) => ({
      globalSourceTree: state.globalSourceTree,
      activeAnimationId: state.selectionState.instanceId,
      selectedKeypoints: state.selectionState.keypoints,
      tracksRevision: state.tracksRevision ?? 0,
    }),
    ({
      globalSourceTree,
      activeAnimationId,
      selectedKeypoints,
    }) => {
      if (!globalSourceTree || globalSourceTree.length === 0) return;

      // Build a set of selected track keys for quick lookup.
      // Registers multiple key formats for flexible matching:
      //   full key ("ns/inst/trackId"), tail ("trackId"), base ("trackBase")
      const selectedTrackLookup = new Set<string>();
      selectedKeypoints.forEach((keypointIds, trackKey) => {
        if (keypointIds && keypointIds.size > 0) {
          selectedTrackLookup.add(trackKey);
          const tail = trackKey.split("/").pop();
          if (tail) {
            selectedTrackLookup.add(tail);
            const base = tail.split(".")[0];
            if (base) selectedTrackLookup.add(base);
          }
        }
      });

      const instancedTrackSources: Record<string, SourceRow> = {};

      // Walk the full source tree (entity → instance → groups → tracks)
      // The tree already has entity/instance groups when appropriate.
      flattenSources(globalSourceTree, activeAnimationId, selectedTrackLookup, instancedTrackSources);

      // Preserve the global row (managed by update-consolidated-source-row)
      const existingGlobal = get().instancedTrackSources?.global;
      // Also preserve any filtered global rows (managed by update-view-filtered-global-rows)
      const existingFiltered: Record<string, SourceRow> = {};
      const current = get().instancedTrackSources ?? {};
      Object.entries(current).forEach(([key, row]) => {
        if (key.startsWith("filtered:")) {
          existingFiltered[key] = row;
        }
      });

      set({
        instancedTrackSources: {
          ...instancedTrackSources,
          ...existingFiltered,
          ...(existingGlobal ? { global: existingGlobal } : {}),
        },
      });
    },
    {
      equalityFn: (current, previous) => {
        // Re-derive when tree, selection, or active instance changes

        const selectionSignature = (selection: AnimationData["selectionState"]["keypoints"]) =>
          Array.from(selection.entries())
            .map(([trackKey, ids]) => ({
              trackKey,
              ids: Array.from(ids).sort(),
            }))
            .sort((left, right) => left.trackKey.localeCompare(right.trackKey));

        return (
          current.activeAnimationId === previous.activeAnimationId &&
          isEqual(selectionSignature(current.selectedKeypoints), selectionSignature(previous.selectedKeypoints)) &&
          current.globalSourceTree === previous.globalSourceTree &&
          current.tracksRevision === previous.tracksRevision
        );
      },
      fireImmediately: true,
    },
  );
}

/**
 * Recursively flatten a Source[] tree into a Record<string, SourceRow>,
 * decorating each node with rendering-specific data (layerBand, selectable, etc.).
 *
 * The `activeAnimationId` is used to determine foreground status per-leaf
 * (each leaf track knows its instanceId, compared against the active one).
 */
function flattenSources(
  sources: Source[],
  activeAnimationId: string | null,
  selectedTrackLookup: Set<string>,
  output: Record<string, SourceRow>,
  depth = 0,
  parentId?: string,
): void {
  const count = sources.length;

  sources.forEach((source, index) => {
    const isLastChild = index === count - 1;

    if (GROUP_TYPES.has(source.type)) {
      const group = source as SourceGroup;

      // Recursively flatten children
      const childOutput: Record<string, SourceRow> = {};
      flattenSources(group.children, activeAnimationId, selectedTrackLookup, childOutput, depth + 1, group.id);

      // All groups (composite, entity, instance) produce rows with
      // aggregate child data typed as "group".
      const childData: SourceRowData[] = Object.values(childOutput)
        .flatMap((row) => row.data)
        .map((data) => ({ ...data, type: "group" as const }));

      if (childData.length > 0) {
        output[group.id] = {
          id: group.id,
          name: group.name,
          expanded: group.expanded,
          data: childData,
          depth,
          isLastChild,
          isGroup: true,
          parentId,
        };

        // Add all child rows to output
        Object.assign(output, childOutput);
      }
    } else {
      const track = source as SourceTrack;
      const trackKey = track.id; // format: "ns/inst/trackId"
      const foreground = Boolean(activeAnimationId) && track.instanceId === activeAnimationId;
      const isSelected =
        foreground &&
        (selectedTrackLookup.has(trackKey) || selectedTrackLookup.has(track.trackId));

      let layerBand = LayerBand.Background;
      if (foreground) {
        layerBand = isSelected ? LayerBand.ForegroundSelected : LayerBand.ForegroundUnselected;
      }

      output[track.id] = {
        id: track.id,
        data: [
          {
            selectable: foreground,
            editable: !track.readonly,
            layerBand,
            animationId: track.animationId,
            namespaceId: track.namespaceId,
            instanceId: track.instanceId,
            type: track.type,
            muted: track.muted ?? false,
            trackId: track.trackId,
            animatableId: track.animatableId,
            iconCode: track.iconCode,
          },
        ],
        depth,
        isLastChild,
        isGroup: false,
        parentId,
      };
    }
  });
}
