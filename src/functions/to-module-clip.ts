import type { Animation } from "../types";
import type { SimpleKeypoint, SimpleRawValue, SimpleTrack } from "../types/data/simple-track";
import { resolveAnimationDuration } from "./compute-animation-extent";
import { resolveSegmentControlPoints } from "./resolve-segment-control-points";

/** An arora `Value` in its JSON form, narrowed to the variants a module clip carries. */
export type AroraValueJson =
  | { bool: boolean }
  | { f32: number }
  | { f64: number }
  | { u32: number }
  | { str: string }
  | { struct: AroraStructJson }
  | { structs: { id: string; elements: { fields: AroraFieldJson[] }[] } };

/** One field of an arora structure: the field's declared id and its value. */
export interface AroraFieldJson {
  id: string;
  value: AroraValueJson;
}

/** An arora structure: its record's declared type id and its fields. */
export interface AroraStructJson {
  id: string;
  fields: AroraFieldJson[];
}

/**
 * The Vizij animation module's `AnimationClip` record, as the arora `Value`
 * its `load_animation` takes, in the JSON form a bridge `Call` carries it
 * (`JSON.stringify` of it is the argument's value).
 */
export interface ModuleClip {
  struct: AroraStructJson;
}

/**
 * The duration of `animation`'s module clip, in milliseconds: the animation's
 * duration as Studio's player derives it, rounded up to whole milliseconds.
 */
export function moduleClipDuration(
  animation: Animation,
  tracks: Record<string, SimpleTrack>,
): number {
  return Math.ceil(resolveAnimationDuration(animation, tracks));
}

/**
 * Converts a Studio animation into the Vizij animation module's clip.
 *
 * - **Tracks.** One module track per Studio track, with the Studio track's
 *   id and name. Of the tracks on one animatable, the first in
 *   `animation.tracks` claims it, as in Studio's playback; a track with no
 *   keypoint claims it too and is left out, so the animatable is not
 *   animated (the module would write `0` for it). Muting is not seen here:
 *   Studio keeps it per instance in the editor's source tree, and a muted
 *   track converts like any other.
 * - **Keys.** A track's `animatable_id` — the key the module reports each
 *   output under — is the Studio animatable id. The clip names no device
 *   key, so one clip serves every entity and device the animation plays on;
 *   checking a track against an entity's animatables and keying its outputs
 *   onto a device's keys belong to whatever loads the clip.
 * - **Time.** `duration` is the animation's duration as Studio's player
 *   derives it (`resolveAnimationDuration`), rounded up to whole milliseconds;
 *   stamps are divided by it, so clip time equals the animation's local time.
 *   Instance offset and timescale are not part of the clip: they are the
 *   player's (seek and speed), as are looping and bounce.
 * - **Values.** Numbers travel as `f64`, booleans as `bool`, strings as `str`.
 *   The module samples numbers in `f32`.
 * - **Keypoints.** Sorted by stamp. Of keypoints sharing the first stamp only
 *   the last is kept, and of keypoints sharing the last stamp only the first:
 *   a segment of no duration plays nothing, so those are the ones the track
 *   holds before its first segment and after its last.
 * - **Transitions.** Strings and booleans hold the left keypoint's value and
 *   carry no handles; at the instant of a keypoint the module plays it. A
 *   numeric segment's Bézier is Studio's own
 *   (`resolveSegmentControlPoints`, the curve the editor draws), normalized to
 *   the segment: `x` over its duration, `y` over its value change. The module
 *   eases between keypoint values, so a segment whose value turns back inside
 *   it — or starts and ends on one value — is cut at each turning point by
 *   exact Bézier subdivision; the inserted keypoints carry the curve's value
 *   there. Every module segment is then monotone in value, which keeps the
 *   normalized handles within `[-1, 2]`.
 *
 * - **Played tracks.** `played` names the tracks the clip carries, in
 *   `animation.tracks` order (all of them by default); the clip lasts the whole
 *   animation's duration whichever it carries. A track left out claims no
 *   animatable, so the next track on its animatable plays, as Studio plays a
 *   muted track's animatable.
 *
 * @throws when a track mixes value types, carries a number the module's `f32`
 *   cannot hold or a non-finite stamp, or when the duration exceeds the
 *   module's `u32` milliseconds.
 */
export function toModuleClip(
  animation: Animation,
  tracks: Record<string, SimpleTrack>,
  played: Iterable<string> = animation.tracks,
): ModuleClip {
  const duration = moduleClipDuration(animation, tracks);
  const carried = new Set(played);
  if (duration > MAX_U32) {
    throw new Error(`animation ${animation.id} lasts ${duration} ms, beyond the module's u32`);
  }

  const claimed = new Set<string>();
  const moduleTracks: { fields: AroraFieldJson[] }[] = [];
  for (const trackId of animation.tracks) {
    const track = tracks[trackId];
    if (!track || !carried.has(trackId)) continue;
    if (claimed.has(track.animatableId)) continue;
    claimed.add(track.animatableId);
    if (track.points.length === 0) continue;
    moduleTracks.push({
      fields: [
        field(FIELD.trackId, { str: track.id }),
        field(FIELD.trackName, { str: track.name }),
        field(FIELD.trackAnimatable, { str: track.animatableId }),
        field(FIELD.trackPoints, {
          structs: {
            id: TYPE.keypoint,
            elements: toModuleKeypoints(track, duration).map(keypointValue),
          },
        }),
      ],
    });
  }

  return {
    struct: {
      id: TYPE.clip,
      fields: [
        field(FIELD.clipName, { str: animation.name }),
        field(FIELD.clipDuration, { u32: duration }),
        field(FIELD.clipTracks, { structs: { id: TYPE.track, elements: moduleTracks } }),
      ],
    },
  };
}

const MAX_U32 = 0xffff_ffff;
/** The largest finite `f32`. */
const MAX_F32 = 3.4028234663852886e38;

/** The module's declared type ids (vizij-animation-module `src/lib.rs`). */
const TYPE = {
  clip: "76697a69-6a00-0000-0000-000000000100",
  track: "76697a69-6a00-0000-0000-000000000101",
  keypoint: "76697a69-6a00-0000-0000-000000000102",
  transitionHandle: "76697a69-6a00-0000-0000-000000000103",
} as const;

/** The module's declared field ids, per record. */
const FIELD = {
  clipName: "76697a69-6a00-0000-0100-000000000001",
  clipDuration: "76697a69-6a00-0000-0100-000000000002",
  clipTracks: "76697a69-6a00-0000-0100-000000000003",
  trackId: "76697a69-6a00-0000-0101-000000000001",
  trackName: "76697a69-6a00-0000-0101-000000000002",
  trackAnimatable: "76697a69-6a00-0000-0101-000000000003",
  trackPoints: "76697a69-6a00-0000-0101-000000000004",
  keypointId: "76697a69-6a00-0000-0102-000000000001",
  keypointStamp: "76697a69-6a00-0000-0102-000000000002",
  keypointValue: "76697a69-6a00-0000-0102-000000000003",
  keypointIn: "76697a69-6a00-0000-0102-000000000004",
  keypointOut: "76697a69-6a00-0000-0102-000000000005",
  handleX: "76697a69-6a00-0000-0103-000000000001",
  handleY: "76697a69-6a00-0000-0103-000000000002",
} as const;

/** A point in (time, value) space, or a handle in a segment's normalized frame. */
interface Point {
  x: number;
  y: number;
}

/** A module keypoint before encoding: stamp in clip milliseconds, handles normalized. */
interface ModuleKeypoint {
  id: string;
  stamp: number;
  value: SimpleRawValue;
  in?: Point;
  out?: Point;
}

function field(id: string, value: AroraValueJson): AroraFieldJson {
  return { id, value };
}

/**
 * A track's keypoints in the module's form: sorted by stamp, each numeric
 * segment's handles set from Studio's control points and cut at its value
 * extrema, and the keypoints a segment of no duration hides left out.
 */
function toModuleKeypoints(track: SimpleTrack, duration: number): ModuleKeypoint[] {
  const points = [...track.points].sort((a, b) => a.stamp - b.stamp);
  const kind = valueKind(track, points);
  const result: ModuleKeypoint[] = points.map((p) => ({
    id: p.id,
    stamp: p.stamp / duration,
    value: p.value,
  }));

  // Walk the segments right to left so the keypoints a cut inserts land after
  // the indices still to visit.
  for (let i = points.length - 2; kind === "number" && i >= 0; i -= 1) {
    const start = points[i];
    const end = points[i + 1];
    if (start.stamp === end.stamp) continue;
    const [p1, p2] = segmentControlPoints(points, i);
    const pieces = splitAtValueExtrema([
      { x: start.stamp, y: start.value as number },
      p1,
      p2,
      { x: end.stamp, y: end.value as number },
    ]);
    const inserted: ModuleKeypoint[] = [];
    pieces.forEach((piece, n) => {
      const handles = normalizedHandles(piece);
      if (n === 0) {
        result[i].out = handles.out;
      } else {
        inserted[n - 1].out = handles.out;
      }
      if (n === pieces.length - 1) {
        result[i + 1].in = handles.in;
      } else {
        inserted.push({
          id: `${start.id}~${n + 1}`,
          stamp: piece[3].x / duration,
          value: piece[3].y,
          in: handles.in,
        });
      }
    });
    result.splice(i + 1, 0, ...inserted);
  }

  // A segment of no duration plays nothing: the track holds its first
  // segment's start before it and its last segment's end after it; with no
  // segment at all, its first keypoint. The module holds its first and last
  // keypoints, so the others on those stamps go.
  const firstStamp = result[0].stamp;
  const lastStamp = result[result.length - 1].stamp;
  const first = result.findLastIndex((p) => p.stamp === firstStamp);
  const last = result.findIndex((p) => p.stamp === lastStamp);
  return first < last ? result.slice(first, last + 1) : [result[0]];
}

/**
 * The one value type of a track, refusing a mix, a number beyond the module's
 * `f32` and a non-finite stamp.
 */
function valueKind(track: SimpleTrack, points: SimpleKeypoint[]): "number" | "string" | "boolean" {
  const kind = typeof points[0].value;
  for (const point of points) {
    if (typeof point.value !== kind) {
      throw new Error(`track ${track.id} mixes ${kind} and ${typeof point.value} values`);
    }
    if (typeof point.value === "number" && !(Math.abs(point.value) <= MAX_F32)) {
      throw new Error(`track ${track.id} keypoint ${point.id} is not a finite f32 number`);
    }
    if (!Number.isFinite(point.stamp)) {
      throw new Error(`track ${track.id} keypoint ${point.id} has no finite stamp`);
    }
  }
  return kind as "number" | "string" | "boolean";
}

/**
 * The world-space control points of the numeric segment `points[i] → points[i + 1]`,
 * resolved as the editor resolves them (`resolveSegmentControlPoints`).
 */
function segmentControlPoints(points: SimpleKeypoint[], i: number): [Point, Point] {
  const start = points[i];
  const end = points[i + 1];
  const prev = points[i - 1];
  const next = points[i + 2];
  const resolved = resolveSegmentControlPoints({
    start: { stamp: start.stamp, value: start.value as number },
    end: { stamp: end.stamp, value: end.value as number },
    transitions: { startOut: start.transitions?.out, endIn: end.transitions?.in },
    neighbors: {
      startPrev: prev && { stamp: prev.stamp, value: prev.value as number },
      endNext: next && { stamp: next.stamp, value: next.value as number },
    },
  });
  const cp1 = resolved.cp1Effective ?? resolved.cp1Raw;
  const cp2 = resolved.cp2Effective ?? resolved.cp2Raw;
  if (!cp1 || !cp2) {
    throw new Error(`segment ${start.id} → ${end.id} resolved no control points`);
  }
  return [cp1, cp2];
}

type Bezier = [Point, Point, Point, Point];

/** Cuts a cubic Bézier in (time, value) at the interior extrema of its value. */
function splitAtValueExtrema(curve: Bezier): Bezier[] {
  const [y0, y1, y2, y3] = curve.map((p) => p.y);
  // y'(s) / 3 = a s² + b s + c
  const a = -y0 + 3 * y1 - 3 * y2 + y3;
  const b = 2 * (y0 - 2 * y1 + y2);
  const c = y1 - y0;
  const roots: number[] = [];
  if (Math.abs(a) < 1e-12 * (Math.abs(b) + Math.abs(c) + 1e-300)) {
    if (b !== 0) roots.push(-c / b);
  } else {
    const discriminant = b * b - 4 * a * c;
    if (discriminant > 0) {
      const sqrt = Math.sqrt(discriminant);
      roots.push((-b - sqrt) / (2 * a), (-b + sqrt) / (2 * a));
    }
  }
  const cuts = roots.filter((s) => s > 1e-9 && s < 1 - 1e-9).sort((p, q) => p - q);

  const pieces: Bezier[] = [];
  let rest = curve;
  let consumed = 0;
  for (const s of cuts) {
    const [left, right] = subdivide(rest, (s - consumed) / (1 - consumed));
    pieces.push(left);
    rest = right;
    consumed = s;
  }
  pieces.push(rest);
  return pieces;
}

/** De Casteljau subdivision of a cubic Bézier at parameter `s`. */
function subdivide([p0, p1, p2, p3]: Bezier, s: number): [Bezier, Bezier] {
  const lerp = (p: Point, q: Point): Point => ({
    x: p.x + (q.x - p.x) * s,
    y: p.y + (q.y - p.y) * s,
  });
  const p01 = lerp(p0, p1);
  const p12 = lerp(p1, p2);
  const p23 = lerp(p2, p3);
  const p012 = lerp(p01, p12);
  const p123 = lerp(p12, p23);
  const mid = lerp(p012, p123);
  return [
    [p0, p01, p012, mid],
    [mid, p123, p23, p3],
  ];
}

/**
 * A segment's handles in the module's frame: `x` from the segment's start
 * time over its duration, `y` from its start value over its value change. A
 * segment of one value has handles of any `y`; it gets the linear ones.
 */
function normalizedHandles([p0, p1, p2, p3]: Bezier): { out: Point; in: Point } {
  const span = p3.x - p0.x;
  const rise = p3.y - p0.y;
  const x1 = (p1.x - p0.x) / span;
  const x2 = (p2.x - p0.x) / span;
  if (rise === 0) {
    return { out: { x: x1, y: x1 }, in: { x: x2, y: x2 } };
  }
  return {
    out: { x: x1, y: (p1.y - p0.y) / rise },
    in: { x: x2, y: (p2.y - p0.y) / rise },
  };
}

function keypointValue(point: ModuleKeypoint): { fields: AroraFieldJson[] } {
  return {
    fields: [
      field(FIELD.keypointId, { str: point.id }),
      field(FIELD.keypointStamp, { f32: point.stamp }),
      field(FIELD.keypointValue, scalarValue(point.value)),
      field(FIELD.keypointIn, handlesValue(point.in)),
      field(FIELD.keypointOut, handlesValue(point.out)),
    ],
  };
}

function scalarValue(value: SimpleRawValue): AroraValueJson {
  if (typeof value === "number") return { f64: value };
  if (typeof value === "boolean") return { bool: value };
  return { str: value };
}

function handlesValue(handle: Point | undefined): AroraValueJson {
  return {
    structs: {
      id: TYPE.transitionHandle,
      elements: handle
        ? [
            {
              fields: [
                field(FIELD.handleX, { f32: handle.x }),
                field(FIELD.handleY, { f32: handle.y }),
              ],
            },
          ]
        : [],
    },
  };
}
