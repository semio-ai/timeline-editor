import { RawValue, AnimatableValue, AnimatableGroupType } from "@semio/utils";
import { GROUP_TYPES } from "../constants";
import { Animation, AnimationInstance, Source, SourceGroup, SourceTrack, Track } from "../types";
import type { TrackGroup } from "../types/data/track-group";
import { getIconCode } from "./get-icon-code";
import { groupDerivedTracks } from "./group-derived-tracks";

export function computeDefaultSourcesFromInstance(
  namespaceId: string,
  animationInstance: AnimationInstance,
  animations: Record<string, Animation>,
  animatables: Record<string, AnimatableValue>,
  tracks: Record<string, Track<RawValue>>,
): Source[] {
  const sources: Source[] = [];

  const animation = animations[animationInstance.animationId];
  if (!animation) {
    console.warn(`Animation with ID ${animationInstance.animationId} not found.`);
    return sources;
  }

  const groups = animation.groups ?? [];

  if (groups.length > 0) {
    const visitGroup = (group: TrackGroup): SourceGroup => {
      const childSources: Source[] = group.children.map((child) => {
        if (typeof child === "string") {
          const track = tracks[child];
          if (!track) {
            const fallbackSource: SourceTrack = {
              id: `${namespaceId}/${animationInstance.id}/${child}`,
              animationId: animation.id,
              namespaceId,
              instanceId: animationInstance.id,
              trackId: child,
              animatableId: child,
              type: "number",
              muted: false,
              visible: true,
              locked: false,
            };
            return fallbackSource;
          }
          const animatable = animatables[track.animatableId];
          const sourceTrack: SourceTrack = {
            id: `${namespaceId}/${animationInstance.id}/${track.id}`,
            animationId: animation.id,
            namespaceId,
            instanceId: animationInstance.id,
            trackId: track.id,
            animatableId: track.animatableId,
            type: (animatable?.type as "string" | "number" | "boolean") ?? "number",
            iconCode: animatable ? getIconCode(animatable.type, animatable.pub?.units) : undefined,
            muted: track.settings?.muted ?? false,
            visible: true,
            locked: false,
          };
          return sourceTrack;
        }
        return visitGroup(child);
      });

      return {
        id: `${namespaceId}/${animationInstance.id}/${group.id}`,
        groupId: group.id,
        name: group.name,
        animationId: animation.id,
        namespaceId,
        instanceId: animationInstance.id,
        type: "group",
        expanded: true,
        children: childSources,
      };
    };

    groups.forEach((group) => sources.push(visitGroup(group)));
    return sources;
  }

  const grouped = groupDerivedTracks(animation.tracks, tracks, animatables);
  grouped.forEach((group) => {
    const hasMultipleChildren = group.children.length > 1;
    const hasDerivedAxis = group.children.some((child) => child.axis);
    const shouldGroup = hasMultipleChildren || hasDerivedAxis;
    const groupName =
      group.name ??
      tracks[group.baseTrackId]?.groupName ??
      group.children[0]?.track.groupName ??
      group.children[0]?.track.name ??
      group.baseTrackId;

    const parentType = group.parentAnimatable?.type;
    const groupType = getGroupType(group.groupType, parentType);

    if (shouldGroup) {
      const childrenSources: SourceTrack[] = group.children.map((child) => {
        const childAnimatable =
          child.derivedAnimatable ??
          animatables[child.track.animatableId] ??
          group.parentAnimatable;
        return {
          id: `${namespaceId}/${animationInstance.id}/${child.trackId}`,
          animationId: animation.id,
          namespaceId,
          instanceId: animationInstance.id,
          trackId: child.trackId,
          animatableId: child.track.animatableId,
          type: "number",
          iconCode: childAnimatable
            ? getIconCode(childAnimatable.type, childAnimatable.pub?.units)
            : undefined,
          muted: child.track.settings?.muted ?? false,
          visible: true,
          locked: false,
        };
      });

      const representative =
        group.children[0]?.derivedAnimatable ??
        animatables[group.children[0]?.track.animatableId] ??
        group.parentAnimatable;

      sources.push({
        id: `${namespaceId}/${animationInstance.id}/${group.baseTrackId}`,
        animationId: animation.id,
        namespaceId,
        instanceId: animationInstance.id,
        name: groupName ?? group.parentAnimatable?.name ?? group.baseTrackId,
        groupId: group.baseTrackId,
        type: groupType,
        iconCode: representative
          ? getIconCode(
              groupType as
                | "string"
                | "number"
                | "boolean"
                | "vector2"
                | "vector3"
                | "euler"
                | "rgb"
                | "hsl"
                | "group",
              representative.pub?.units,
            )
          : undefined,
        children: childrenSources,
        expanded: true,
      });
    } else {
      const child = group.children[0];
      if (!child) return;
      const animatable = animatables[child.track.animatableId];
      sources.push({
        id: `${namespaceId}/${animationInstance.id}/${child.trackId}`,
        animationId: animation.id,
        namespaceId,
        instanceId: animationInstance.id,
        trackId: child.trackId,
        animatableId: child.track.animatableId,
        type: (animatable?.type as "string" | "number" | "boolean") ?? "number",
        iconCode: animatable ? getIconCode(animatable.type, animatable.pub?.units) : undefined,
        muted: child.track.settings?.muted ?? false,
        visible: true,
        locked: false,
      });
    }
  });

  return sources;
}

function getGroupType(groupType?: string, parentType?: string): AnimatableGroupType {
  if (groupType && GROUP_TYPES.has(groupType as string)) {
    return groupType as AnimatableGroupType;
  } else if (parentType && GROUP_TYPES.has(parentType as string)) {
    return parentType as AnimatableGroupType;
  } else {
    return AnimatableGroupType.Group;
  }
}
