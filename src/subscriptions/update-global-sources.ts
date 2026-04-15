import { shallow } from "zustand/shallow";
import { isEqual } from "lodash";
import type {
  AnimationApi,
  AnimationData,
  AnimationStoreGetter,
  AnimationStoreSetter,
} from "../store-types";
import { Source, SourceGroup, SourceTrack } from "../types";
import { computeDefaultSourcesFromInstance } from "../functions";
import { collectSourcesByInstance as collectSourcesByInstanceFromTree } from "../functions/source-tree-utils";
import { GROUP_TYPES } from "../constants";

/**
 * Updates the global source tree and per-instance index when namespaces,
 * animations, tracks, or animatables change.
 *
 * Produces:
 * - `globalSourceTree`: Full hierarchy with entity/instance group wrapping
 *   (entity → instance → composite groups → tracks). Entity/instance groups
 *   are omitted when only one entity or one instance exists (auto-collapse).
 * Per-instance sources are built internally then wrapped into the tree.
 */
export function updateGlobalSources(
  api: AnimationApi,
  set: AnimationStoreSetter,
  get: AnimationStoreGetter,
): () => void {
  return api.subscribe(
    (state: AnimationData) => ({
      namespaces: state.namespaces,
      animations: state.animations,
      tracks: state.tracks,
      animatables: state.animatables,
    }),
    ({ namespaces, animations, tracks, animatables }) => {
      const previousTree = get().globalSourceTree;
      const previousByInstance = collectSourcesByInstanceFromTree(previousTree);

      // Step 1: Build per-instance sources with state preservation
      const sourcesByInstance: Record<string, Source[]> = {};

      const namespaceEntries = Object.entries(namespaces);

      for (const [namespaceId, namespace] of namespaceEntries) {
        const animationInstances = Object.values(namespace.animationInstances);
        for (const animationInstance of animationInstances) {
          const sources = computeDefaultSourcesFromInstance(
            namespaceId,
            animationInstance,
            animations,
            animatables,
            tracks,
          );
          sourcesByInstance[animationInstance.id] = mergeSourceState(
            sources,
            previousByInstance[animationInstance.id],
          );
        }
      }

      // Step 2: Build the full tree with entity/instance wrapping
      const totalNamespaces = namespaceEntries.length;
      const showEntityLevel = totalNamespaces > 1;

      const globalSourceTree: Source[] = [];

      for (const [namespaceId, namespace] of namespaceEntries) {
        const instanceEntries = Object.values(namespace.animationInstances);
        const totalInstances = instanceEntries.length;
        const showInstanceLevel = totalInstances > 1;

        // Collect instance-level groups (or direct sources if no instance grouping)
        const namespaceSources: Source[] = [];

        for (const instance of instanceEntries) {
          const instanceSources = sourcesByInstance[instance.id] ?? [];
          if (instanceSources.length === 0) continue;

          if (showInstanceLevel) {
            // Wrap in an instance-level group
            const animationName = animations[instance.animationId]?.name ?? "Unnamed Animation";
            const instanceGroupId = `instance:${namespaceId}/${instance.id}`;

            // Preserve expanded state from previous tree
            const prevExpanded = findPreviousExpanded(previousTree, instanceGroupId);

            const instanceGroup: SourceGroup = {
              id: instanceGroupId,
              groupId: instanceGroupId,
              name: animationName,
              animationId: instance.animationId,
              namespaceId,
              instanceId: instance.id,
              type: "instance",
              expanded: prevExpanded ?? true,
              children: instanceSources,
            };
            namespaceSources.push(instanceGroup);
          } else {
            // Single instance — add sources directly (no instance group)
            namespaceSources.push(...instanceSources);
          }
        }

        if (namespaceSources.length === 0) continue;

        if (showEntityLevel) {
          // Wrap in an entity-level group
          const entityGroupId = `entity:${namespaceId}`;
          const prevExpanded = findPreviousExpanded(previousTree, entityGroupId);

          const entityGroup: SourceGroup = {
            id: entityGroupId,
            groupId: entityGroupId,
            name: namespace.name,
            animationId: "",
            namespaceId,
            instanceId: "",
            type: "entity",
            expanded: prevExpanded ?? true,
            children: namespaceSources,
          };
          globalSourceTree.push(entityGroup);
        } else {
          // Single entity — add sources directly (no entity group)
          globalSourceTree.push(...namespaceSources);
        }
      }

      set({
        globalSourceTree,
      });
    },
    {
      equalityFn: (current, previous) => {
        const allCurrentTracks = new Set(
          Object.values(current.animations).flatMap((a) => a.tracks),
        );
        const allPreviousTracks = new Set(
          Object.values(previous.animations).flatMap((a) => a.tracks),
        );
        const currentAnimationIds = new Set(Object.keys(current.animations));
        const previousAnimationIds = new Set(Object.keys(previous.animations));

        return (
          isEqual(allCurrentTracks, allPreviousTracks) &&
          isEqual(currentAnimationIds, previousAnimationIds) &&
          shallow(current.namespaces, previous.namespaces) &&
          shallow(current.animatables, previous.animatables)
        );
      },
      fireImmediately: true,
    },
  );
}

/**
 * Recursively merge previous source state (expanded, muted) into new sources.
 */
function mergeSourceState(next: Source[], previous?: Source[]): Source[] {
  if (!previous || previous.length === 0) {
    return next;
  }
  const previousById = new Map(previous.map((source) => [source.id, source]));
  return next.map((source) => {
    const previousSource = previousById.get(source.id);
    if (GROUP_TYPES.has(source.type)) {
      const group = source as SourceGroup;
      const previousGroup =
        previousSource && GROUP_TYPES.has(previousSource.type)
          ? (previousSource as SourceGroup)
          : undefined;
      return {
        ...group,
        expanded: previousGroup?.expanded ?? group.expanded,
        children: mergeSourceState(group.children, previousGroup?.children),
      };
    }
    const track = source as SourceTrack;
    const previousTrack =
      previousSource && !GROUP_TYPES.has(previousSource.type)
        ? (previousSource as SourceTrack)
        : undefined;
    return {
      ...track,
      hidden: false,
      muted: previousTrack?.muted ?? track.muted,
      visible: previousTrack?.visible ?? track.visible,
      locked: previousTrack?.locked ?? track.locked,
    };
  });
}

/**
 * Find the previous expanded state for a group by ID in the old tree.
 */
function findPreviousExpanded(tree: Source[], targetId: string): boolean | undefined {
  for (const source of tree) {
    if (source.id === targetId && GROUP_TYPES.has(source.type)) {
      return (source as SourceGroup).expanded;
    }
    if (GROUP_TYPES.has(source.type)) {
      const found = findPreviousExpanded((source as SourceGroup).children, targetId);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}
