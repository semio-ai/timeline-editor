import { AnimatableGroupType } from "@semio/utils";
import type { AnimatableValue, DeprecatedComplexAnimatableValue, RawValue } from "@semio/utils";
import type { StoredAnimation, Track } from "../types";
import { COMPLEX_TYPES, TYPE_FIELDS } from "../constants";
import { flattenCompositeTracks } from "./flatten-tracks";

import { assertReadableAnimationFormat } from "./migrate-animation-format";

type AnimatableValueLike = AnimatableValue | DeprecatedComplexAnimatableValue;

export interface MigrationResult {
  animation: StoredAnimation;
  animatables: Record<string, AnimatableValue>;
}

/**
 * Migrate a stored animation + animatables into the scalar track/animatable shape.
 * This flattens composite tracks, replaces complex animatables with derived scalar
 * animatables, and sets deterministic group ids based on the base animatable id.
 */
export function migrateAnimationData(
  animation: StoredAnimation,
  animatables: Record<string, AnimatableValueLike>,
): MigrationResult {
  assertReadableAnimationFormat(animation);
  const sourceTracks = animation.tracks.reduce<Record<string, Track<RawValue>>>((acc, track) => {
    acc[track.id] = track;
    return acc;
  }, {});

  if (!sourceTracks || Object.keys(sourceTracks).length === 0) {
    return {
      animation: { ...animation, tracks: [] },
      animatables: filterScalarAnimatables(animatables),
    };
  }

  const { tracks: flattenedTracks, derivedChildren } = flattenCompositeTracks(
    sourceTracks,
    animatables,
    { preserveOriginal: false },
  );

  const nextTracks: Record<string, Track<RawValue>> = {};
  const nextAnimatables: Record<string, AnimatableValue> = filterScalarAnimatables(animatables);

  Object.entries(flattenedTracks).forEach(([trackId, track]) => {
    const baseAnimatable = animatables[track.animatableId];
    if (!baseAnimatable || !COMPLEX_TYPES.has(baseAnimatable.type)) {
      nextTracks[trackId] = track;
      return;
    }

    const axis = extractAxis(trackId);
    const derivedAnimatableId = `${baseAnimatable.id}.${axis}`;
    const baseTrackId = trackId.split(".")[0];
    nextTracks[trackId] = {
      ...track,
      name: axis,
      groupName: baseAnimatable.name ?? baseTrackId,
      animatableId: derivedAnimatableId,
    };

    if (!nextAnimatables[derivedAnimatableId]) {
      nextAnimatables[derivedAnimatableId] = buildDerivedAnimatable(
        baseAnimatable,
        axis,
        derivedAnimatableId,
        {
          id: baseAnimatable.id,
          type: toAnimatableGroupType(baseAnimatable.type),
        },
      );
    }
  });

  const nextTrackOrder = animation.tracks.flatMap((track) => {
    const derived = derivedChildren[track.id];
    return derived && derived.length > 0 ? derived : [track.id];
  });

  const nextTracksArray = nextTrackOrder
    .map((trackId) => nextTracks[trackId])
    .filter((track): track is Track<RawValue> => Boolean(track));

  return {
    animation: {
      ...animation,
      tracks: nextTracksArray,
    },
    animatables: nextAnimatables,
  };
}

function filterScalarAnimatables(
  animatables: Record<string, AnimatableValueLike>,
): Record<string, AnimatableValue> {
  return Object.values(animatables).reduce<Record<string, AnimatableValue>>((acc, animatable) => {
    if (!COMPLEX_TYPES.has(animatable.type)) {
      acc[animatable.id] = animatable as AnimatableValue;
    }
    return acc;
  }, {});
}

function extractAxis(trackId: string): string {
  const parts = trackId.split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "x";
}

function buildDerivedAnimatable(
  base: AnimatableValueLike,
  axis: string,
  derivedId: string,
  groupInfo: { id: string; type: AnimatableGroupType },
): AnimatableValue {
  const axisIndex = TYPE_FIELDS[base.type]?.indexOf(axis) ?? -1;
  let defaultValue = 0;
  if (typeof base.default === "object" && base.default !== null) {
    defaultValue = (base.default as unknown as Record<string, number>)[axis] ?? 0;
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
  return {
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
      return AnimatableGroupType.Group;
  }
}

function derivePubOutput(output: string, axis: string): string {
  if (!output) return output;
  if (output.endsWith(`.${axis}`)) return output;
  return `${output}.${axis}`;
}
