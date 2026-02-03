import type { AnimatableValue, DeprecatedComplexAnimatableValue, RawValue } from "@semio/utils";
import cloneDeep from "lodash/cloneDeep";
import type { Track } from "../types";
import { COMPLEX_TYPES, TYPE_FIELDS } from "../constants";

type AnimatableValueLike = AnimatableValue | DeprecatedComplexAnimatableValue;

export interface FlattenCompositeTracksOptions {
  /**
   * When true (default), the original composite tracks remain in the returned
   * record alongside the generated component tracks. Set to false to drop the
   * parent entries after deriving the component tracks.
   */
  preserveOriginal?: boolean;
}

export interface FlattenCompositeTracksResult {
  tracks: Record<string, Track<RawValue>>;
  derivedChildren: Record<string, string[]>;
}

/**
 * Expands any composite-value tracks (vector/euler/color) into deterministic,
 * per-component scalar tracks. Component track ids follow the
 * `${trackId}.${field}` convention so downstream code can infer lineage
 * without additional lookups.
 */
export function flattenCompositeTracks(
  sourceTracks: Record<string, Track<RawValue>>,
  animatables: Record<string, AnimatableValueLike>,
  options?: FlattenCompositeTracksOptions,
): FlattenCompositeTracksResult {
  const preserveOriginal = options?.preserveOriginal ?? true;
  const tracks: Record<string, Track<RawValue>> = preserveOriginal ? cloneDeep(sourceTracks) : {};
  const derivedChildren: Record<string, string[]> = {};

  Object.entries(sourceTracks).forEach(([trackId, track]) => {
    const animatable = animatables[track.animatableId];
    if (!animatable || !COMPLEX_TYPES.has(animatable.type)) {
      if (!preserveOriginal && !tracks[trackId]) {
        tracks[trackId] = cloneDeep(track);
      }
      return;
    }

    const componentFields = TYPE_FIELDS[animatable.type] ?? [];
    if (componentFields.length === 0) {
      if (!preserveOriginal && !tracks[trackId]) {
        tracks[trackId] = cloneDeep(track);
      }
      return;
    }

    const animatableName = animatable.name ?? track.name;

    derivedChildren[trackId] = componentFields.map((field) => {
      const derivedId = `${trackId}.${field}`;
      tracks[derivedId] = {
        ...track,
        id: derivedId,
        name: animatableName,
        points: track.points.map((point) => ({
          ...point,
          id: `${point.id}.${field}`,
          value: extractComponentValue(point.value, field),
        })),
      };
      return derivedId;
    });

    if (preserveOriginal && !tracks[trackId]) {
      tracks[trackId] = cloneDeep(track);
    }
  });

  return { tracks, derivedChildren };
}

function extractComponentValue(candidate: RawValue, field: string): RawValue {
  if (
    candidate &&
    typeof candidate === "object" &&
    field in (candidate as unknown as Record<string, unknown>)
  ) {
    const record = candidate as unknown as Record<string, RawValue>;
    const next = record[field];
    if (typeof next === "number") {
      return next;
    }
  }
  return 0;
}
