import type { RawValue } from "@semio/data";
import type { Animation, StoredAnimation, Track, TrackGroup } from "../types";
import { CURRENT_ANIMATION_FORMAT_VERSION } from "../types/data/animation";
import {
  StandardTransitionType,
  TransitionDirective,
  TransitionPairing,
} from "../types/data/keypoint";
import type { AuthoredTransition } from "../types/data/keypoint";
import type { SimpleRawValue, SimpleTrack } from "../types/data/simple-track";
import { resolveAnimationDuration } from "./compute-animation-extent";
import { isStoredAnimationContent, NotAnAnimationError } from "./is-stored-animation-content";
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
/** Format 3 storage document in nanoseconds; clip length is resolved at playback. */
export interface PersistedAnimation {
  formatVersion: 3;
  id: string;
  name: string;
  groups: TrackGroup[];
  defaultViewportExtentNs?: number;
  tracks: ClipTrack[];
}

const namedTransitions = new Set<string>([
  ...Object.values(StandardTransitionType),
  ...Object.values(TransitionDirective),
]);
enum HandlePrecision {
  WholeNanoseconds,
  Exact,
}

function safeNanoseconds(milliseconds: number, field: string): number {
  const nanoseconds = Math.round(milliseconds * 1e6);
  if (!Number.isSafeInteger(nanoseconds))
    throw new Error(`${field} cannot be written as safe integer nanoseconds`);
  return nanoseconds;
}

function writeTransition(
  value: AuthoredTransition | undefined,
  precision: HandlePrecision,
): ClipTransition | undefined {
  const integerHandles = precision === HandlePrecision.WholeNanoseconds;
  if (value === undefined) return undefined;
  if (typeof value === "string" && namedTransitions.has(value)) return value as ClipTransition;
  if (typeof value === "object" && value && Number.isFinite(value.x) && Number.isFinite(value.y)) {
    const dtNs = integerHandles ? safeNanoseconds(value.x, "transition dtNs") : value.x * 1e6;
    if (Number.isFinite(dtNs)) return { dtNs, dv: value.y };
  }
  if (integerHandles) throw new Error("Cannot write an invalid transition in format 3");
  return undefined;
}

function writeTrack(track: Track<RawValue>, precision: HandlePrecision): ClipTrack {
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
        in: writeTransition(point.transitions.in, precision),
        out: writeTransition(point.transitions.out, precision),
        pairing: point.transitions.pairing,
      };
      return {
        id: point.id,
        timeNs:
          precision === HandlePrecision.WholeNanoseconds
            ? safeNanoseconds(point.stamp, `Keypoint ${point.id} timeNs`)
            : Math.round(point.stamp * 1e6),
        value: point.value as SimpleRawValue,
        transitions,
      };
    }),
  };
}

function animationDocument(
  animation: Animation,
  tracks: Record<string, Track<RawValue>>,
  precision: HandlePrecision,
): PersistedAnimation {
  let defaultViewportExtentNs: number | undefined;
  if (animation.defaultViewportExtent !== undefined) {
    defaultViewportExtentNs =
      precision === HandlePrecision.WholeNanoseconds
        ? safeNanoseconds(animation.defaultViewportExtent, "defaultViewportExtentNs")
        : Math.round(animation.defaultViewportExtent * 1e6);
  }
  return {
    formatVersion: CURRENT_ANIMATION_FORMAT_VERSION,
    id: animation.id,
    name: animation.name,
    groups: animation.groups,
    defaultViewportExtentNs,
    tracks: animation.tracks.map((id) => writeTrack(tracks[id], precision)),
  };
}

/**
 * Write format 3 with editor metadata and no clip length. Runtime-only mute is excluded.
 * Throws if rounded times or handle deltas are unsafe integers, a transition is
 * invalid, or the resulting document fails the reader's structural admission.
 * Studio saves through writeAnimationForStorage; switching that function to this
 * writer is a one-line change once clients that read format 3 are in production.
 */
export function writeStoredAnimation(
  animation: Animation,
  tracks: Record<string, Track<RawValue>>,
): PersistedAnimation {
  const document = animationDocument(animation, tracks, HandlePrecision.WholeNanoseconds);
  if (!isStoredAnimationContent(document))
    throw new Error("Cannot write format 3: invalid content");
  return document;
}

/** Prepare a standalone clip with the content/viewport/one-second duration floor. */
export function clipDocument(animation: Animation, tracks: Record<string, Track<RawValue>>) {
  return {
    ...animationDocument(animation, tracks, HandlePrecision.Exact),
    lengthNs: Math.round(resolveAnimationDuration(animation, tracks) * 1e6),
  };
}

/** A track's engine clip 2.0 document; fractional handle nanoseconds preserve v2 curves. */
export function clipTrackJson(track: SimpleTrack): string {
  return JSON.stringify(writeTrack(track, HandlePrecision.Exact));
}

/** A number track's keypoints as columns: what an evaluator compiles with no text to parse. */
export interface ClipTrackColumns {
  /** Clip-local times in whole nanoseconds, in the track's order. */
  timesNs: Float64Array;
  values: Float64Array;
  /**
   * Six numbers a keypoint: the transition it arrives by, then the one it
   * leaves by, each a code, a time delta in nanoseconds and a value delta.
   * The code is -1 for none, -2 for a handle of the two deltas, and
   * otherwise the code `codeOf` gives the transition's name.
   */
  transitions: Float64Array;
}

/**
 * A number track's keypoints as {@link ClipTrackColumns}, written as
 * {@link clipTrackJson} writes them (times rounded to whole nanoseconds, a
 * transition the document leaves out left out here), so the two compile to
 * one curve; `undefined` for a track holding a value that is not a number.
 * Throws for a transition name `codeOf` has no code for.
 */
export function clipTrackColumns(
  track: SimpleTrack,
  codeOf: (name: string) => number | undefined,
): ClipTrackColumns | undefined {
  const { points } = track;
  if (!points.every((point) => typeof point.value === "number")) return undefined;
  const columns: ClipTrackColumns = {
    timesNs: new Float64Array(points.length),
    values: new Float64Array(points.length),
    transitions: new Float64Array(points.length * 6).fill(-1),
  };
  // Each side as `writeTrack` writes it into the document.
  const side = (authored: AuthoredTransition | undefined, at: number) => {
    const transition = writeTransition(authored, HandlePrecision.Exact);
    if (transition === undefined) return;
    if (typeof transition === "object") {
      columns.transitions[at] = -2;
      // A document writes -0 as 0.
      columns.transitions[at + 1] = transition.dtNs + 0;
      columns.transitions[at + 2] = transition.dv + 0;
      return;
    }
    const code = codeOf(transition);
    if (code === undefined) throw new Error(`No code for the transition ${transition}`);
    columns.transitions[at] = code;
  };
  points.forEach((point, i) => {
    columns.timesNs[i] = Math.round(point.stamp * 1e6) + 0;
    columns.values[i] = (point.value as number) + 0;
    side(point.transitions?.in, i * 6);
    side(point.transitions?.out, i * 6 + 3);
  });
  return columns;
}

function readTransition(value: ClipTransition | undefined): AuthoredTransition | undefined {
  if (value === undefined || typeof value === "string") return value;
  return { x: value.dtNs / 1e6, y: value.dv };
}

/**
 * Read formats 1, 2 and 3 into the embedded millisecond model; malformed content
 * throws NotAnAnimationError. Unknown versions retain their version refusal.
 * Per-format requirements and legacy metadata permissiveness are documented on
 * isStoredAnimationContent, the admission shared with core.
 */
export function readStoredAnimation(content: unknown): StoredAnimation {
  assertReadableAnimationFormat(content);
  if (!isStoredAnimationContent(content)) throw new NotAnAnimationError();
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
  return {
    id: stored.id,
    name: stored.name,
    formatVersion: 2,
    groups: stored.groups,
    defaultViewportExtent:
      stored.defaultViewportExtentNs === undefined
        ? undefined
        : stored.defaultViewportExtentNs / 1e6,
    tracks,
  };
}

/**
 * Studio saves format 2 so deployed millisecond readers can open every save.
 * Once format-3 readers are in production, the body can return
 * writeStoredAnimation(animation, tracks) in a one-line switch. Mute is runtime-only.
 */
export function writeAnimationForStorage(
  animation: Animation,
  tracks: Record<string, Track<RawValue>>,
): PersistedAnimation | StoredAnimation {
  return {
    id: animation.id,
    name: animation.name,
    duration: animation.duration,
    tracks: animation.tracks.map((id) => {
      const track = tracks[id];
      const { muted: _, ...rest } = track.settings || {};
      return { ...track, settings: Object.keys(rest).length > 0 ? rest : undefined };
    }),
    groups: animation.groups,
    defaultViewportExtent:
      animation.viewportExtentFromDuration && animation.defaultViewportExtent === animation.duration
        ? undefined
        : animation.defaultViewportExtent,
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
