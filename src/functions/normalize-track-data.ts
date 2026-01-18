import type { AnimatableValue, RawValue } from "@semio/utils";
import cloneDeep from "lodash/cloneDeep";
import type { Animation, Track } from "../types";
import { COMPLEX_TYPES, TYPE_FIELDS } from "../constants";
import { flattenCompositeTracks } from "./flatten-tracks";

interface NormalizeTrackDataParams {
  tracks?: Record<string, Track<RawValue>>;
  animations?: Record<string, Animation>;
  animatables?: Record<string, AnimatableValue>;
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
  if (!tracks || !animatables) {
    return { tracks, animations, animatables };
  }

  const { tracks: flattenedTracks, derivedChildren } = flattenCompositeTracks(tracks, animatables, {
    preserveOriginal: false,
  });

  const nextTracks: Record<string, Track<RawValue>> = {};
  const nextAnimatables: Record<string, AnimatableValue> = {};
  const derivedAnimatableIds = new Set<string>();

  Object.values(animatables).forEach((animatable) => {
    if (!COMPLEX_TYPES.has(animatable.type)) {
      nextAnimatables[animatable.id] = animatable;
    }
  });

  Object.entries(flattenedTracks).forEach(([trackId, track]) => {
    const baseAnimatable = animatables[track.animatableId];
    if (!baseAnimatable || !COMPLEX_TYPES.has(baseAnimatable.type)) {
      nextTracks[trackId] = track;
      return;
    }

    const axis = extractAxis(trackId);
    const derivedAnimatableId = `${track.animatableId}.${axis}`;
    track.name = axis;
    track.groupName = baseAnimatable.name ?? trackId;
    track.animatableId = derivedAnimatableId;
    nextTracks[trackId] = track;

    if (!derivedAnimatableIds.has(derivedAnimatableId)) {
      nextAnimatables[derivedAnimatableId] = buildDerivedAnimatable(
        baseAnimatable,
        axis,
        derivedAnimatableId,
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
  base: AnimatableValue,
  axis: string,
  derivedId: string,
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
  const derived = cloneDeep(base);
  derived.id = derivedId;
  derived.name = `${base.name ?? derivedId} ${axis.toUpperCase()}`;
  derived.name = axis;
  derived.type = "number";
  derived.default = typeof defaultValue === "number" ? defaultValue : 0;
  derived.constraints = {
    min: typeof constraintMin === "number" ? constraintMin : undefined,
    max: typeof constraintMax === "number" ? constraintMax : undefined,
    velocity,
  };
  return derived;
}
