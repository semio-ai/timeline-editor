import type { AnimatableValue, DeprecatedComplexAnimatableValue, RawValue } from "@semio/utils";
import type { Track } from "../types";

type AnimatableValueLike = AnimatableValue | DeprecatedComplexAnimatableValue;

export interface DerivedTrackGroupChild {
  trackId: string;
  track: Track<RawValue>;
  axis?: string;
  derivedAnimatable?: AnimatableValueLike;
}

export interface DerivedTrackGroup {
  baseTrackId: string;
  groupId?: string;
  groupType?: string;
  parentAnimatable?: AnimatableValueLike;
  name?: string;
  children: DerivedTrackGroupChild[];
}

export function groupDerivedTracks(
  trackIds: string[],
  tracks: Record<string, Track<RawValue>>,
  animatables: Record<string, AnimatableValueLike>,
): DerivedTrackGroup[] {
  const groups = new Map<string, DerivedTrackGroup>();

  trackIds.forEach((trackId) => {
    const track = tracks[trackId];
    if (!track) return;

    const segments = trackId.split(".");
    const inferredBaseTrackId = segments[0];
    const animatable = animatables[track.animatableId];
    const groupInfo =
      animatable && typeof animatable === "object"
        ? (animatable as { group?: AnimatableValue["group"] }).group
        : undefined;
    const baseTrackId = groupInfo?.id ?? inferredBaseTrackId;
    const axis = groupInfo?.axis ?? (segments.length > 1 ? segments.slice(1).join(".") : undefined);

    const derivedAnimatable = animatable;
    const parentAnimatableId = track.animatableId.split(".")[0];
    const parentAnimatable = animatables[parentAnimatableId] ?? derivedAnimatable;

    const preferredName =
      track.groupName ?? parentAnimatable?.name ?? derivedAnimatable?.name ?? track.name;
    const bucket: DerivedTrackGroup = groups.get(baseTrackId) ?? {
      baseTrackId,
      groupId: groupInfo?.id,
      groupType: groupInfo?.type,
      parentAnimatable,
      name: track.groupName ?? parentAnimatable?.name ?? derivedAnimatable?.name ?? baseTrackId,
      children: [],
    };
    bucket.parentAnimatable = parentAnimatable ?? bucket.parentAnimatable;
    bucket.name =
      track.groupName ?? bucket.name ?? parentAnimatable?.name ?? preferredName ?? baseTrackId;
    bucket.groupId = groupInfo?.id ?? bucket.groupId;
    bucket.groupType = groupInfo?.type ?? bucket.groupType;

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
