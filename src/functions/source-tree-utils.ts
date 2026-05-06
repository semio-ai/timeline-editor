import { Source, SourceGroup, SourceTrack } from "../types";
import { GROUP_TYPES } from "../constants";

/**
 * Collect all leaf-level Source[] arrays from the tree, grouped by instance ID.
 * Walks through entity/instance groups to find the per-instance subtrees.
 * Returns the same structure as the old `sourcesByInstance` field.
 */
export function collectSourcesByInstance(
  tree: Source[],
): Record<string, Source[]> {
  const result: Record<string, Source[]> = {};

  function walk(sources: Source[]) {
    for (const source of sources) {
      if (GROUP_TYPES.has(source.type)) {
        const group = source as SourceGroup;
        if (group.type === "entity" || group.type === "instance") {
          // Organizational group — recurse into children
          walk(group.children);
        } else {
          // Composite group — this belongs to a specific instance
          const instanceId = group.instanceId;
          if (instanceId) {
            if (!result[instanceId]) result[instanceId] = [];
            result[instanceId].push(source);
          }
        }
      } else {
        // Leaf track
        const track = source as SourceTrack;
        const instanceId = track.instanceId;
        if (instanceId) {
          if (!result[instanceId]) result[instanceId] = [];
          result[instanceId].push(source);
        }
      }
    }
  }

  walk(tree);
  return result;
}

/**
 * Get the Source[] subtree for a specific instance ID.
 * Walks through entity/instance groups to find sources belonging to that instance.
 */
export function getInstanceSources(
  tree: Source[],
  instanceId: string,
): Source[] {
  const result: Source[] = [];

  function walk(sources: Source[]) {
    for (const source of sources) {
      if (GROUP_TYPES.has(source.type)) {
        const group = source as SourceGroup;
        if (group.type === "entity" || group.type === "instance") {
          // Organizational group — recurse
          walk(group.children);
        } else if (group.instanceId === instanceId) {
          result.push(source);
        }
      } else {
        const track = source as SourceTrack;
        if (track.instanceId === instanceId) {
          result.push(source);
        }
      }
    }
  }

  walk(tree);
  return result;
}

/**
 * Collect all Source[] arrays across all instances, flattened.
 * Equivalent to Object.values(sourcesByInstance).flat() on the old field.
 */
export function collectAllSources(tree: Source[]): Source[] {
  const result: Source[] = [];

  function walk(sources: Source[]) {
    for (const source of sources) {
      if (GROUP_TYPES.has(source.type)) {
        const group = source as SourceGroup;
        if (group.type === "entity" || group.type === "instance") {
          walk(group.children);
        } else {
          result.push(source);
        }
      } else {
        result.push(source);
      }
    }
  }

  walk(tree);
  return result;
}

/**
 * Check if any instance in the tree has sources.
 */
export function hasAnySources(tree: Source[]): boolean {
  return tree.length > 0;
}
