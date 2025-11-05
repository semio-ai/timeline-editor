import type { TrackKey } from "../types";

export function buildTrackKey(namespaceId: string, instanceId: string, trackId: string): TrackKey {
  return `${namespaceId}/${instanceId}/${trackId}` as TrackKey;
}

export function parseTrackKey(trackKey: string): {
  namespaceId: string;
  instanceId: string;
  trackId: string;
} {
  const [namespaceId = "", instanceId = "", trackId = ""] = trackKey.split("/");
  return { namespaceId, instanceId, trackId };
}
