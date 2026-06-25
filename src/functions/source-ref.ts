import { uniq } from "lodash";
import type { SourceRef, SourceRow } from "../types/util/source";

/**
 * Resolves the {@link SourceRef} a flattened {@link SourceRow} derives from.
 *
 * Uses the row's `sourceType` (carried from the source group during
 * flattening) plus its data entries — never parses the row id. Composite
 * groups (vector3/euler/…) back a single animatable when all their component
 * tracks share one animatableId; otherwise they fall back to a local
 * `trackGroup` label so behavior is never worse than today.
 */
export function resolveSourceRef(row: SourceRow): SourceRef | undefined {
  const first = row.data[0];
  if (!first) return undefined;

  if (!row.isGroup) {
    return first.trackId ? { kind: "track", trackId: first.trackId } : undefined;
  }

  switch (row.sourceType) {
    case "entity": {
      // Pass the namespaceId through opaquely; the host resolves the entity
      // identity (it owns the namespace-id convention), not this package.
      const namespaceId = first.namespaceId;
      if (!namespaceId) return undefined;
      return { kind: "entity", namespaceId };
    }
    case "instance": {
      if (!first.animationId || !first.instanceId || !first.namespaceId) return undefined;
      return {
        kind: "animation",
        animationId: first.animationId,
        instanceId: first.instanceId,
        namespaceId: first.namespaceId,
      };
    }
    case "vector3":
    case "vector2":
    case "euler":
    case "rgb":
    case "hsl": {
      const animatableIds = uniq(row.data.map((d) => d.animatableId).filter(Boolean));
      if (animatableIds.length === 1) {
        return { kind: "animatable", animatableId: animatableIds[0] };
      }
      return { kind: "trackGroup", trackIds: uniq(row.data.map((d) => d.trackId).filter(Boolean)) };
    }
    case "group":
    default:
      return { kind: "trackGroup", trackIds: uniq(row.data.map((d) => d.trackId).filter(Boolean)) };
  }
}
