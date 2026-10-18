import type { RawValue } from "@semio/utils";
import type { Animation, StoredAnimation, Track, TrackGroup } from "../types";
import { CURRENT_ANIMATION_FORMAT_VERSION } from "../types/data/animation";
import {
  StandardTransitionType,
  TransitionDirective,
  TransitionPairing,
} from "../types/data/keypoint";
import type { AuthoredTransition } from "../types/data/keypoint";
import type { SimpleRawValue, SimpleTrack } from "../types/data/simple-track";
import { computeTrackExtent, resolveAnimationDuration } from "./compute-animation-extent";
import {
  assertReadableAnimationFormat,
  migrateToMillisecondStamps,
} from "./migrate-animation-format";

export type ClipTransition =
  | StandardTransitionType
  | TransitionDirective
  | { dtNs: number; dv: number };
export interface ClipPoint {
  id: string;
  timeNs: number;
  value: SimpleRawValue;
  transitions?: { in?: ClipTransition; out?: ClipTransition; pairing?: TransitionPairing };
}
/** Clip 2.0's JSON track, with Studio's optional editing metadata. */
export interface ClipTrack {
  id: string;
  name: string;
  animatableId: string;
  inputKey?: string;
  groupName?: string;
  settings?: { color?: string };
  points: ClipPoint[];
}
/** The nanosecond document written to storage, distinct from StoredAnimation in ms. */
export interface PersistedAnimation {
  formatVersion: 3;
  id: string;
  name: string;
  lengthNs: number;
  groups: TrackGroup[];
  defaultViewportExtent?: number;
  tracks: ClipTrack[];
}

const namedTransitions = new Set<string>([
  ...Object.values(StandardTransitionType),
  ...Object.values(TransitionDirective),
]);
function writeTransition(value: AuthoredTransition | undefined): ClipTransition | undefined {
  if (typeof value === "string")
    return namedTransitions.has(value) ? (value as ClipTransition) : undefined;
  if (!value || !Number.isFinite(value.x) || !Number.isFinite(value.y)) return undefined;
  const dtNs = value.x * 1e6;
  return Number.isFinite(dtNs) ? { dtNs, dv: value.y } : undefined;
}

function writeTrack(track: Track<RawValue>): ClipTrack {
  return {
    id: track.id,
    name: track.name,
    animatableId: track.animatableId,
    inputKey: track.inputKey,
    groupName: track.groupName,
    settings: track.settings?.color === undefined ? undefined : { color: track.settings.color },
    points: track.points.map((point) => {
      if (!["number", "boolean", "string"].includes(typeof point.value)) {
        throw new Error(
          `Keypoint ${point.id} of track ${track.id} must be scalar before serialization`,
        );
      }
      const transitions = point.transitions && {
        in: writeTransition(point.transitions.in),
        out: writeTransition(point.transitions.out),
        pairing: point.transitions.pairing,
      };
      return {
        id: point.id,
        timeNs: Math.round(point.stamp * 1e6),
        value: point.value as SimpleRawValue,
        transitions,
      };
    }),
  };
}

/** Write clip 2.0 plus editor metadata. Runtime-only mute state is excluded. */
export function writeStoredAnimation(
  animation: Animation,
  tracks: Record<string, Track<RawValue>>,
): PersistedAnimation {
  return {
    formatVersion: CURRENT_ANIMATION_FORMAT_VERSION,
    id: animation.id,
    name: animation.name,
    lengthNs: Math.round(resolveAnimationDuration(animation, tracks) * 1e6),
    groups: animation.groups,
    defaultViewportExtent: animation.defaultViewportExtent,
    tracks: animation.tracks.map((id) => writeTrack(tracks[id])),
  };
}

/** A track's clip 2.0 JSON document, shared by evaluation and persistence. */
export function clipTrackJson(track: SimpleTrack): string {
  return JSON.stringify(writeTrack(track));
}

function readTransition(value: ClipTransition | undefined): AuthoredTransition | undefined {
  if (value === undefined || typeof value === "string") return value;
  return { x: value.dtNs / 1e6, y: value.dv };
}

/** Read all supported persisted formats into the embedded millisecond model. */
export function readStoredAnimation(content: unknown): StoredAnimation {
  assertReadableAnimationFormat(content);
  const stored = content as StoredAnimation | PersistedAnimation;
  if (stored.formatVersion !== 3) return migrateToMillisecondStamps(stored);
  const tracks = stored.tracks.map((track) => ({
    ...track,
    points: track.points.map((point) => ({
      id: point.id,
      stamp: point.timeNs / 1e6,
      value: point.value,
      transitions: point.transitions && {
        in: readTransition(point.transitions.in),
        out: readTransition(point.transitions.out),
        pairing: point.transitions.pairing,
      },
    })),
  }));
  // The editor's duration is the latest of its content, its viewport extent
  // and a second; a clip longer than all three (one another writer made, with
  // a hold after its last keypoint) keeps its length as the viewport extent.
  // Compared in whole nanoseconds, as the writer rounds the length.
  const derivedNs = Math.round(
    Math.max(computeTrackExtent(tracks), stored.defaultViewportExtent ?? 0, 1000) * 1e6,
  );
  return {
    id: stored.id,
    name: stored.name,
    formatVersion: 2,
    groups: stored.groups,
    defaultViewportExtent:
      stored.lengthNs > derivedNs ? stored.lengthNs / 1e6 : stored.defaultViewportExtent,
    tracks,
  };
}

/** Whether every value of every track `animation` names is a scalar. */
function holdsOnlyScalars(animation: Animation, tracks: Record<string, Track<RawValue>>): boolean {
  return animation.tracks.every((id) =>
    (tracks[id]?.points ?? []).every((point) =>
      ["number", "boolean", "string"].includes(typeof point.value),
    ),
  );
}

/**
 * What the editor saves: format 3, unless a track holds a value format 3
 * cannot (a composite, from before animatables were split into scalar
 * channels); that animation is saved in format 2, as it was read, so nothing
 * of it is lost. Runtime-only mute state is excluded either way.
 */
export function writeAnimationForStorage(
  animation: Animation,
  tracks: Record<string, Track<RawValue>>,
): PersistedAnimation | StoredAnimation {
  if (holdsOnlyScalars(animation, tracks)) return writeStoredAnimation(animation, tracks);
  return {
    id: animation.id,
    name: animation.name,
    tracks: animation.tracks.map((id) => {
      const track = tracks[id];
      const { muted: _, ...rest } = track.settings || {};
      return { ...track, settings: Object.keys(rest).length > 0 ? rest : undefined };
    }),
    groups: animation.groups,
    defaultViewportExtent: animation.defaultViewportExtent,
    formatVersion: 2,
  };
}

/** Serialize embedded content through the same writer as the editor store. */
export function persistStoredAnimation(content: unknown): PersistedAnimation | StoredAnimation {
  const stored = readStoredAnimation(content);
  return writeAnimationForStorage(
    { ...stored, tracks: stored.tracks.map((track) => track.id) },
    Object.fromEntries(stored.tracks.map((track) => [track.id, track])),
  );
}
