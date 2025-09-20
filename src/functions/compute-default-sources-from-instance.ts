import { RawValue, AnimatableValue } from "@semio/utils";
import { Animation, AnimationInstance, Source, SourceTrack, Track } from "../types";
import { getIconCode } from "./get-icon-code";

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

  if (animation.groups && Object.keys(animation.groups).length > 0) {
    console.warn(
      `Animation ${animation.id} has groups defined, but groups are not yet supported in instanced track sources.`,
    );
  }

  animation.tracks.forEach((trackId) => {
    const track = tracks[trackId];
    if (!track) {
      console.warn(`Track with ID ${trackId} not found in animation ${animation.id}.`);
      return;
    }
    const animatable = animatables[track.animatableId];
    if (!animatable) {
      console.warn(`Animatable with ID ${track.animatableId} not found for track ${trackId}.`);
      return;
    }
    const trackType = animatable.type;

    if (COMPLEX_TYPES.has(trackType)) {
      // Get the children sources;
      const childrenSources: SourceTrack[] = TYPE_FIELDS[trackType as string].map((field) => ({
        id: `${namespaceId}/${animationInstance.id}/${trackId}/${field}`,
        animationId: animation.id,
        namespaceId,
        instanceId: animationInstance.id,
        trackId,
        animatableId: track.animatableId,
        type: "number",
        attribute: field,
        iconCode: getIconCode(animatable, field),
        muted: track.settings?.muted || false,
        hidden: false,
      }));
      sources.push({
        id: `${namespaceId}/${animationInstance.id}/${trackId}`,
        animationId: animation.id,
        namespaceId,
        instanceId: animationInstance.id,
        name: track.name || "Unnamed Track",
        groupId: trackId,
        type: trackType as "vector2" | "vector3" | "euler" | "rgb" | "hsl" | "group",
        iconCode: getIconCode(animatable),
        children: childrenSources,
        expanded: true,
      });
    } else {
      sources.push({
        id: `${namespaceId}/${animationInstance.id}/${trackId}`,
        animationId: animation.id,
        namespaceId,
        instanceId: animationInstance.id,
        trackId,
        animatableId: track.animatableId,
        type: trackType as "string" | "number" | "boolean",
        iconCode: getIconCode(animatable),
        muted: track.settings?.muted || false,
        hidden: false,
      });
    }
  });

  return sources;
}

const COMPLEX_TYPES = new Set(["vector2", "vector3", "euler", "rgb", "hsl"]);

const TYPE_FIELDS: Record<string, string[]> = {
  vector2: ["x", "y"],
  vector3: ["x", "y", "z"],
  euler: ["r", "p", "y"],
  rgb: ["r", "g", "b"],
  hsl: ["h", "s", "l"],
};
