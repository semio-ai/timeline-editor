import type { RawValue } from "@semio/utils";
import type { Namespace, Source, Track } from "../types";
import { parseTrackKey } from "../utils/track-key";
import { computeVisibleSourceTracks } from "./compute-visible-source-tracks";

export interface ResolvedTrackEntry {
  namespaceId: string;
  instanceId: string;
  trackId: string;
  trackKey: string;
  animatableId: string;
}

interface ResolveTrackEntriesOptions {
  includeHidden?: boolean;
  includeMuted?: boolean;
}

export function resolveTrackEntriesByAnimatable(
  namespaces: Record<string, Namespace>,
  sourcesByAnimationInstance: Record<string, Source[]>,
  tracks: Record<string, Track<RawValue>>,
  options: ResolveTrackEntriesOptions = {},
): Map<string, Map<string, ResolvedTrackEntry>> {
  const includeHidden = options.includeHidden ?? true;
  const includeMuted = options.includeMuted ?? false;
  const resolved = new Map<string, Map<string, ResolvedTrackEntry>>();

  Object.entries(namespaces).forEach(([namespaceId, namespace]) => {
    const resolvedByAnimatable = new Map<string, ResolvedTrackEntry>();
    const instances = Object.values(namespace.animationInstances ?? {});

    instances.forEach((instance) => {
      const sources = sourcesByAnimationInstance[instance.id];
      if (!sources) return;

      const trackKeys = computeVisibleSourceTracks(sources, { includeHidden, includeMuted });
      trackKeys.forEach((trackKey) => {
        const parsed = parseTrackKey(trackKey);
        const trackId = parsed.trackId;
        const track = tracks[trackId];
        if (!track) return;

        const animatableId = track.animatableId;
        if (!animatableId) return;

        if (!resolvedByAnimatable.has(animatableId)) {
          resolvedByAnimatable.set(animatableId, {
            namespaceId: parsed.namespaceId || namespaceId,
            instanceId: parsed.instanceId || instance.id,
            trackId,
            trackKey,
            animatableId,
          });
        }
      });
    });

    if (resolvedByAnimatable.size > 0) {
      resolved.set(namespaceId, resolvedByAnimatable);
    }
  });

  return resolved;
}
