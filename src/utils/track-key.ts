export function buildTrackKey(namespaceId: string, instanceId: string, trackId: string): string {
  return `${namespaceId}/${instanceId}/${trackId}`;
}

export function parseTrackKey(trackKey: string): {
  namespaceId: string;
  instanceId: string;
  trackId: string;
} {
  const [namespaceId = "", instanceId = "", trackId = ""] = trackKey.split("/");
  return { namespaceId, instanceId, trackId };
}
