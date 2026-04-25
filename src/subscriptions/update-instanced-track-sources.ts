import { isEqual } from "lodash";
import type {
  AnimationApi,
  AnimationData,
  AnimationStoreGetter,
  AnimationStoreSetter,
} from "../store-types";
import { LayerBand, Source, SourceGroup, SourceRow, SourceRowData, SourceTrack } from "../types";
import { GROUP_TYPES } from "../constants";
import { isFilteredSourceRowId } from "../functions/view-filtered-source-row";

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
    ({ globalSourceTree, activeAnimationId, selectedKeypoints }) => {
      // When the tree is missing or empty, fall through to write an empty
      // instancedTrackSources (preserving filtered entries from the other
      // subscription). Early-returning here would leave stale rows in place
      // whenever the tree transitions from populated to empty — e.g. when
      // the last track is removed or the active animation changes to one
      // with no tracks. flattenSources on an empty input array is a no-op,
      // so the downstream write produces `{ global: { id, data: [] } }`.
      const sources = globalSourceTree ?? [];

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
      const globalLeafData: SourceRowData[] = [];

      // Walk the full source tree (entity → instance → groups → tracks).
      // Leaf data is also accumulated into globalLeafData for the global aggregate row.
      flattenSources(
        sources,
        activeAnimationId,
        selectedTrackLookup,
        instancedTrackSources,
        globalLeafData,
      );

      // The global row aggregates all leaf track data — used by the timeline canvas renderer.
      instancedTrackSources.global = { id: "global", data: globalLeafData };

      // Preserve any per-view filtered twins (managed by update-view-filtered-source-rows)
      const existingFiltered: Record<string, SourceRow> = {};
      const current = get().instancedTrackSources ?? {};
      Object.entries(current).forEach(([key, row]) => {
        if (isFilteredSourceRowId(key)) {
          existingFiltered[key] = row;
        }
      });

      set({
        instancedTrackSources: {
          ...instancedTrackSources,
          ...existingFiltered,
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
          isEqual(
            selectionSignature(current.selectedKeypoints),
            selectionSignature(previous.selectedKeypoints),
          ) &&
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
 *
 * Returns the leaf data accumulated under the processed sources so that
 * ancestor group rows can aggregate only unique leaves (not descendant
 * group rows), preventing duplicate counting in nested group hierarchies.
 */
function flattenSources(
  sources: Source[],
  activeAnimationId: string | null,
  selectedTrackLookup: Set<string>,
  output: Record<string, SourceRow>,
  globalLeafData: SourceRowData[],
  depth = 0,
  parentId?: string,
): SourceRowData[] {
  const count = sources.length;
  const localLeafData: SourceRowData[] = [];

  sources.forEach((source, index) => {
    const isLastChild = index === count - 1;

    if (GROUP_TYPES.has(source.type)) {
      const group = source as SourceGroup;

      // Recursively flatten children. The returned array is the flat list of
      // LEAF data under this group (excluding nested group aggregate rows),
      // so we can roll it up without duplicates.
      const childOutput: Record<string, SourceRow> = {};
      const descendantLeafData = flattenSources(
        group.children,
        activeAnimationId,
        selectedTrackLookup,
        childOutput,
        globalLeafData,
        depth + 1,
        group.id,
      );

      // All groups (composite, entity, instance) produce rows with
      // aggregate child data typed as "group".
      const childData: SourceRowData[] = descendantLeafData.map((data) => ({
        ...data,
        type: "group" as const,
      }));

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

        // Propagate these leaves up to our caller
        localLeafData.push(...descendantLeafData);
      }
    } else {
      const track = source as SourceTrack;
      const trackKey = track.id; // format: "ns/inst/trackId"
      const foreground = Boolean(activeAnimationId) && track.instanceId === activeAnimationId;
      const isSelected =
        foreground && (selectedTrackLookup.has(trackKey) || selectedTrackLookup.has(track.trackId));

      const locked = track.locked ?? false;
      const readonly = track.readonly ?? false;
      // Both user-toggle `locked` and document-permission `readonly`
      // produce the same visual affordance (the foreground-locked
      // overlay), since to the user the track is non-editable for the
      // same reason — only the *cause* (and toggle availability) differs.
      const nonEditable = locked || readonly;
      let layerBand = LayerBand.Background;
      if (foreground && nonEditable) {
        layerBand = LayerBand.ForegroundLocked;
      } else if (foreground) {
        layerBand = isSelected ? LayerBand.ForegroundSelected : LayerBand.ForegroundUnselected;
      }

      output[track.id] = {
        id: track.id,
        data: [
          {
            // `selectable` and `editable` both honor permission-driven readonly
            // and user-toggle locked. The two flags also flow through to row
            // data so the UI can distinguish them (e.g. disable the Lock
            // toggle when readonly is true).
            selectable: foreground && !(track.locked ?? false) && !track.readonly,
            editable: !track.readonly && !(track.locked ?? false),
            layerBand,
            animationId: track.animationId,
            namespaceId: track.namespaceId,
            instanceId: track.instanceId,
            type: track.type,
            muted: track.muted ?? false,
            visible: track.visible ?? true,
            locked: track.locked ?? false,
            readonly: track.readonly ?? false,
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

      // Accumulate leaf data for both the global aggregate row and the
      // local rollup used by ancestor groups.
      const leafData = output[track.id].data[0];
      globalLeafData.push(leafData);
      localLeafData.push(leafData);
    }
  });

  return localLeafData;
}
