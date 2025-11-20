import type { AnimatableValue, RawValue } from "@semio/utils";
import type { Track } from "../types";

export interface DerivedTrackGroupChild {
  trackId: string;
  track: Track<RawValue>;
  axis?: string;
  derivedAnimatable?: AnimatableValue;
}

export interface DerivedTrackGroup {
  baseTrackId: string;
  parentAnimatable?: AnimatableValue;
  name?: string;
  children: DerivedTrackGroupChild[];
}

export function groupDerivedTracks(
  trackIds: string[],
  tracks: Record<string, Track<RawValue>>,
  animatables: Record<string, AnimatableValue>,
): DerivedTrackGroup[] {
  const groups = new Map<string, DerivedTrackGroup>();

  trackIds.forEach((trackId) => {
    const track = tracks[trackId];
    if (!track) return;

    const segments = trackId.split(".");
    const baseTrackId = segments[0];
    const axis = segments.length > 1 ? segments.slice(1).join(".") : undefined;

    const derivedAnimatable = animatables[track.animatableId];
    const parentAnimatableId = track.animatableId.split(".")[0];
    const parentAnimatable = animatables[parentAnimatableId] ?? derivedAnimatable;

    const preferredName =
      parentAnimatable?.name ?? track.groupName ?? track.name ?? derivedAnimatable?.name;
    const bucket = groups.get(baseTrackId) ?? {
      baseTrackId,
      parentAnimatable,
      name: track.groupName ?? parentAnimatable?.name ?? baseTrackId,
      children: [],
    };
    bucket.parentAnimatable = parentAnimatable ?? bucket.parentAnimatable;
    bucket.name =
      track.groupName ?? bucket.name ?? parentAnimatable?.name ?? preferredName ?? baseTrackId;

    bucket.children.push({
      trackId,
      track,
      axis,
      derivedAnimatable,
    });
    groups.set(baseTrackId, bucket);
  });

  return Array.from(groups.values());
}
