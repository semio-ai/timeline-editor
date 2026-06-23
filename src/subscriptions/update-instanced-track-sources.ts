import { isEqual } from "lodash";
import type {
  AnimationApi,
  AnimationData,
  AnimationStoreGetter,
  AnimationStoreSetter,
} from "../store-types";
import { LayerBand, Source, SourceGroup, SourceRow, SourceRowData, SourceTrack } from "../types";
import { GROUP_TYPES } from "../constants";
import { computeRowEditPredicates } from "../functions/row-edit-state";
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
      // Per-entity active instances (the rig-driving instance for each
      // entity). Drives foreground/background coloring so the canvas
      // matches what's actually playing back, not editor selection focus
      // — the latter can drift from the active driver during playback per
      // focusSelectionInstance's partial playback gate.
      entityStates: state.entityStates,
      // Currently focused entity for editing. Only the focused entity's
      // active instance is "actually editable"; other entities' active
      // instances render in the locked layer (visible color, but not
      // interactive from this focus).
      activeEntityId: state.activeEntityId,
      selectionInstanceId: state.selectionState.instanceId,
      selectedKeypoints: state.selectionState.keypoints,
      tracksRevision: state.tracksRevision ?? 0,
    }),
    ({
      globalSourceTree,
      entityStates,
      activeEntityId,
      selectionInstanceId,
      selectedKeypoints,
    }) => {
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
        entityStates,
        activeEntityId,
        selectionInstanceId,
        selectedKeypoints,
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
        // Re-derive when tree, selection, focus, or any entity's active
        // instance changes. This equality function runs on every main-store
        // set, including playback ticks that don't touch any of these fields
        // — keep the common case (stable references) cheap by
        // short-circuiting before any allocation.
        if (
          current.globalSourceTree === previous.globalSourceTree &&
          current.entityStates === previous.entityStates &&
          current.activeEntityId === previous.activeEntityId &&
          current.selectionInstanceId === previous.selectionInstanceId &&
          current.selectedKeypoints === previous.selectedKeypoints &&
          current.tracksRevision === previous.tracksRevision
        ) {
          return true;
        }

        const selectionSignature = (selection: AnimationData["selectionState"]["keypoints"]) =>
          Array.from(selection.entries())
            .map(([trackKey, ids]) => ({
              trackKey,
              ids: Array.from(ids).sort(),
            }))
            .sort((left, right) => left.trackKey.localeCompare(right.trackKey));

        // Compare entityStates by content (not reference) — only the
        // `activeInstanceId` per entity matters for layerBand derivation.
        const entityStatesSignature = (states: AnimationData["entityStates"]) =>
          Object.entries(states)
            .map(([entityId, state]) => `${entityId}:${state.activeInstanceId ?? ""}`)
            .sort();

        return (
          isEqual(
            entityStatesSignature(current.entityStates),
            entityStatesSignature(previous.entityStates),
          ) &&
          isEqual(
            selectionSignature(current.selectedKeypoints),
            selectionSignature(previous.selectedKeypoints),
          ) &&
          current.globalSourceTree === previous.globalSourceTree &&
          current.activeEntityId === previous.activeEntityId &&
          current.selectionInstanceId === previous.selectionInstanceId &&
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
 * Per-leaf predicates are computed by the shared {@link computeRowEditPredicates}
 * helper — same source of truth used by the sidebar (`track-control`) and
 * the row background tint (`use-row-background`). The compound-name
 * highlighting (e.g. selecting `position.x` also marks the parent
 * `position`) is layered on top via the precomputed `selectedTrackLookup`
 * Set, which already contains the trackId, its tail, and its dot-base.
 *
 * Returns the leaf data accumulated under the processed sources so that
 * ancestor group rows can aggregate only unique leaves (not descendant
 * group rows), preventing duplicate counting in nested group hierarchies.
 */
function flattenSources(
  sources: Source[],
  entityStates: AnimationData["entityStates"],
  activeEntityId: AnimationData["activeEntityId"],
  selectionInstanceId: AnimationData["selectionState"]["instanceId"],
  selectedKeypoints: AnimationData["selectionState"]["keypoints"],
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
        entityStates,
        activeEntityId,
        selectionInstanceId,
        selectedKeypoints,
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
          sourceType: group.type,
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
      const owningEntityId = track.namespaceId.split("@")[0];
      const locked = track.locked ?? false;
      const readonly = track.readonly ?? false;
      // Both user-toggle `locked` and document-permission `readonly`
      // produce the same visual affordance (the foreground-locked
      // overlay), since to the user the track is non-editable for the
      // same reason — only the *cause* (and toggle availability) differs.
      const nonEditable = locked || readonly;

      // Single source of truth for row edit/visibility predicates. Same
      // helper drives the sidebar widget (track-control), the row tint
      // (use-row-background), and this canvas-side layerBand decision —
      // no more parallel re-derivations to keep in sync.
      const predicates = computeRowEditPredicates({
        owningEntityId,
        rowInstanceId: track.instanceId,
        trackIds: [track.trackId],
        nonEditable,
        activeEntityId,
        entityStates,
        selectionInstanceId,
        selectedKeypoints,
      });

      // Compound-name fallback (e.g. selecting `position.x` also flags
      // `position`) and full-trackKey form aren't carried by the helper's
      // trackId-only check, so OR them in here on top of the helper's
      // scope gate.
      const isSelected =
        predicates.isInSelection ||
        (predicates.isInSelectionScope && selectedTrackLookup.has(trackKey));

      let layerBand = LayerBand.Background;
      if (predicates.isCurrentlyEdited) {
        layerBand = isSelected ? LayerBand.ForegroundSelected : LayerBand.ForegroundUnselected;
      } else if (predicates.isActiveDriverForOwningEntity) {
        layerBand = LayerBand.ForegroundLocked;
      }

      output[track.id] = {
        id: track.id,
        data: [
          {
            // Selectable: only the focused entity's active instance is
            // interactively selectable. `editable` remains the per-track
            // mutability flag, independent of focus.
            selectable:
              predicates.isFocusedEntity &&
              predicates.isActiveDriverForOwningEntity &&
              !nonEditable,
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
