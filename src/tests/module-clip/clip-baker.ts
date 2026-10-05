import type { AroraValueJson, ModuleClip } from "../../functions/to-module-clip";
import type { TrackBaker } from "../../functions/track-curve";
import type { SimpleRawValue } from "../../types/data/simple-track";

/**
 * A {@link TrackBaker} for tests that need curves without the module: it reads
 * the clip back and samples the track as vizij-animation-core's
 * `sample_track` does — clip time normalized to the duration, a numeric
 * segment eased by the cubic Bézier of its left keypoint's out handle and its
 * right keypoint's in handle (`(0.42, 0)` and `(0.58, 1)` by default), a
 * string or boolean segment holding its left value, the first and last
 * keypoints held outside them. It samples in `f64` where the module samples
 * in `f32`. `to-module-clip.test.ts` holds it to the module's own `bake`.
 */
export const clipBaker: TrackBaker = (clip, trackId, rateHz) => {
  const { duration, tracks } = decode(clip);
  const track = tracks.find((candidate) => candidate.id === trackId);
  if (!track || track.points.length === 0) return undefined;
  // As the module counts its frames: in `f32`, the end included.
  const count = Math.ceil(Math.fround(Math.fround(duration / 1000) * Math.fround(rateHz))) + 1;
  return Array.from({ length: count }, (_, i) =>
    sample(track.points, Math.min((i * 1000) / rateHz / duration, 1)),
  );
};

interface Point {
  stamp: number;
  value: SimpleRawValue;
  in?: { x: number; y: number };
  out?: { x: number; y: number };
}

function sample(points: Point[], u: number): SimpleRawValue {
  const last = points.length - 1;
  if (last === 0 || u <= points[0].stamp) return points[0].value;
  if (u >= points[last].stamp) return points[last].value;
  const i = points.findIndex(
    (point, k) => k < last && u >= point.stamp && u <= points[k + 1].stamp,
  );
  const [left, right] = [points[i], points[i + 1]];
  if (typeof left.value !== "number" || typeof right.value !== "number") return left.value;
  const local = (u - left.stamp) / Math.max(right.stamp - left.stamp, Number.EPSILON);
  const { x: x1, y: y1 } = left.out ?? { x: 0.42, y: 0 };
  const { x: x2, y: y2 } = right.in ?? { x: 0.58, y: 1 };
  let lo = 0;
  let hi = 1;
  for (let k = 0; k < 64; k += 1) {
    const mid = (lo + hi) / 2;
    if (cubic(0, x1, x2, 1, mid) < local) lo = mid;
    else hi = mid;
  }
  const eased = cubic(0, y1, y2, 1, (lo + hi) / 2);
  return left.value + (right.value - left.value) * eased;
}

function cubic(p0: number, p1: number, p2: number, p3: number, s: number): number {
  const m = 1 - s;
  return p0 * m * m * m + 3 * p1 * m * m * s + 3 * p2 * m * s * s + p3 * s * s * s;
}

/** The clip's duration and tracks, read by field position as `toModuleClip` writes them. */
function decode(clip: ModuleClip): { duration: number; tracks: { id: string; points: Point[] }[] } {
  const [, duration, tracks] = clip.struct.fields.map((field) => field.value);
  return {
    duration: scalar(duration) as number,
    tracks: elements(tracks).map(({ fields }) => {
      const [id, , , points] = fields.map((field) => field.value);
      return {
        id: scalar(id) as string,
        points: elements(points).map(({ fields: point }) => {
          const [, stamp, value, handleIn, handleOut] = point.map((field) => field.value);
          return {
            stamp: scalar(stamp) as number,
            value: scalar(value),
            in: handle(handleIn),
            out: handle(handleOut),
          };
        }),
      };
    }),
  };
}

function handle(value: AroraValueJson): { x: number; y: number } | undefined {
  const [first] = elements(value);
  if (!first) return undefined;
  const [x, y] = first.fields.map((field) => scalar(field.value) as number);
  return { x, y };
}

function elements(value: AroraValueJson) {
  if (!("structs" in value)) throw new Error(`expected structures, got ${JSON.stringify(value)}`);
  return value.structs.elements;
}

function scalar(value: AroraValueJson): SimpleRawValue {
  for (const tag of ["f32", "f64", "u32", "bool", "str"] as const) {
    if (tag in value) return (value as Record<string, SimpleRawValue>)[tag];
  }
  throw new Error(`expected a scalar, got ${JSON.stringify(value)}`);
}
