import { AnimatableGroupType } from "@semio/data";
import type {
  AnimatableValue,
  AnimatableGroupInfo,
  DeprecatedComplexAnimatableValue,
  RawValue,
} from "@semio/data";
import type { Animation, Track } from "../types";
import { COMPLEX_TYPES, TYPE_FIELDS } from "../constants";
import { flattenCompositeTracks } from "./flatten-tracks";

type AnimatableValueLike = AnimatableValue | DeprecatedComplexAnimatableValue;

interface NormalizeTrackDataParams {
  tracks?: Record<string, Track<RawValue>>;
  animations?: Record<string, Animation>;
  animatables?: Record<string, AnimatableValueLike>;
}

interface NormalizeTrackDataResult {
  tracks?: Record<string, Track<RawValue>>;
  animations?: Record<string, Animation>;
  animatables?: Record<string, AnimatableValue>;
}

/**
 * Converts composite-value tracks into scalar per-component tracks and updates
 * the related animations/animatables so the runtime store only ever sees simple
 * numeric/string/boolean values.
 */
export function normalizeTrackData({
  tracks,
  animations,
  animatables,
}: NormalizeTrackDataParams): NormalizeTrackDataResult {
  if (!tracks || !animatables || Object.keys(tracks).length === 0) {
    return { tracks, animations, animatables: animatables as Record<string, AnimatableValue> };
  }

  const { tracks: flattenedTracks, derivedChildren } = flattenCompositeTracks(tracks, animatables, {
    preserveOriginal: false,
  });

  const nextTracks: Record<string, Track<RawValue>> = {};
  const nextAnimatables: Record<string, AnimatableValue> = {};
  const derivedAnimatableIds = new Set<string>();
  const groupIdsByAnimatable = new Map<string, string>();

  Object.values(animatables).forEach((animatable) => {
    if (!COMPLEX_TYPES.has(animatable.type)) {
      // The animatable is already simple, just copy it over.
      nextAnimatables[animatable.id] = animatable as AnimatableValue;
    }
  });

  Object.entries(flattenedTracks).forEach(([trackId, track]) => {
    const baseAnimatableId = track.animatableId;
    const baseAnimatable = animatables[baseAnimatableId];
    if (!baseAnimatable || !COMPLEX_TYPES.has(baseAnimatable.type)) {
      nextTracks[trackId] = track;
      return;
    }

    const axis = extractAxis(trackId);
    const derivedAnimatableId = `${baseAnimatableId}.${axis}`;
    track.name = axis;
    const baseTrackId = trackId.split(".")[0];
    track.groupName = baseAnimatable.name ?? baseTrackId;
    track.animatableId = derivedAnimatableId;
    nextTracks[trackId] = track;

    if (!derivedAnimatableIds.has(derivedAnimatableId)) {
      const groupId = groupIdsByAnimatable.get(baseAnimatableId) ?? baseAnimatableId;
      groupIdsByAnimatable.set(baseAnimatableId, groupId);
      nextAnimatables[derivedAnimatableId] = buildDerivedAnimatable(
        baseAnimatable,
        axis,
        derivedAnimatableId,
        {
          id: groupId,
          type: toAnimatableGroupType(baseAnimatable.type),
        },
      );
      derivedAnimatableIds.add(derivedAnimatableId);
    }
  });

  const nextAnimations = animations
    ? Object.fromEntries(
        Object.entries(animations).map(([animationId, animation]) => {
          const nextTrackIds: string[] = [];
          animation.tracks.forEach((trackId) => {
            const children = derivedChildren[trackId];
            if (children && children.length > 0) {
              nextTrackIds.push(...children);
            } else {
              nextTrackIds.push(trackId);
            }
          });
          return [animationId, { ...animation, tracks: nextTrackIds }];
        }),
      )
    : animations;

  return {
    tracks: nextTracks,
    animations: nextAnimations,
    animatables: nextAnimatables,
  };
}

function extractAxis(trackId: string): string {
  const parts = trackId.split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "x";
}

function buildDerivedAnimatable(
  base: AnimatableValueLike,
  axis: string,
  derivedId: string,
  groupInfo: Pick<AnimatableGroupInfo, "id" | "type">,
): AnimatableValue {
  const axisIndex = TYPE_FIELDS[base.type]?.indexOf(axis) ?? -1;
  let defaultValue = 0;
  if (typeof base.default === "object" && base.default !== null) {
    defaultValue = (base.default as any as Record<string, number>)[axis] ?? 0;
  } else if (typeof base.default === "number") {
    defaultValue = base.default;
  }

  const constraints = base.constraints as
    | { min?: number | (number | null)[]; max?: number | (number | null)[]; velocity?: number }
    | undefined;

  const constraintMin = Array.isArray(constraints?.min)
    ? (constraints?.min?.[axisIndex] ?? undefined)
    : (constraints?.min as number | undefined);
  const constraintMax = Array.isArray(constraints?.max)
    ? (constraints?.max?.[axisIndex] ?? undefined)
    : (constraints?.max as number | undefined);

  const velocity = (constraints as { velocity?: number } | undefined)?.velocity;
  const derived: AnimatableValue = {
    id: derivedId,
    name: `${base.name ?? derivedId} ${axis.toUpperCase()}`,
    type: "number",
    default: typeof defaultValue === "number" ? defaultValue : 0,
    constraints: {
      min: typeof constraintMin === "number" ? constraintMin : undefined,
      max: typeof constraintMax === "number" ? constraintMax : undefined,
      velocity,
    },
    pub: base.pub
      ? {
          ...base.pub,
          output: derivePubOutput(base.pub.output, axis),
        }
      : undefined,
    group: {
      id: groupInfo.id,
      type: groupInfo.type,
      axis,
      order: axisIndex >= 0 ? axisIndex : undefined,
    },
  };

  return derived;
}

function toAnimatableGroupType(type: AnimatableValueLike["type"]): AnimatableGroupType {
  switch (type) {
    case "vector2":
      return AnimatableGroupType.Vector2;
    case "vector3":
      return AnimatableGroupType.Vector3;
    case "euler":
      return AnimatableGroupType.Euler;
    case "rgb":
      return AnimatableGroupType.RGB;
    case "hsl":
      return AnimatableGroupType.HSL;
    default:
      throw new Error(`Unsupported group type "${type}" for derived animatable.`);
  }
}

function derivePubOutput(output: string, axis: string): string {
  if (!output) return output;
  if (output.endsWith(`.${axis}`)) return output;
  return `${output}.${axis}`;
}
