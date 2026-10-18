import { computeLocalStamp } from "../src/functions/compute-instance-time";
import { resolveSegmentControlPoints } from "../src/functions/resolve-segment-control-points";
import type { AnimationInstanceSettings } from "../src/types/data/animation";
import type { SimpleRawValue, SimpleTrack } from "../src/types/data/simple-track";

export interface TrackSample {
  value: SimpleRawValue | null;
  /** Value units per second of world time; null for discrete values. */
  velocity: number | null;
}

type Cubic = [number, number, number, number];

export function cubic([a, b, c, d]: Cubic, u: number): number {
  const v = 1 - u;
  return a * v ** 3 + 3 * b * v ** 2 * u + 3 * c * v * u ** 2 + d * u ** 3;
}

function derivative([a, b, c, d]: Cubic, u: number): number {
  return 3 * ((b - a) * (1 - u) ** 2 + 2 * (c - b) * (1 - u) * u + (d - c) * u ** 2);
}

/** Resolve in local space so every handle's time delta scales with its anchors. */
export function referenceCurve(track: SimpleTrack, settings: AnimationInstanceSettings) {
  const points = [...track.points].sort((a, b) => a.stamp - b.stamp);
  const numeric = (i: number) => {
    const point = points[i];
    return point && { stamp: point.stamp, value: point.value as number };
  };
  const segments = points.slice(0, -1).flatMap((start, i) => {
    const end = points[i + 1];
    if (start.stamp === end.stamp) return [];
    let bezier: { x: Cubic; y: Cubic } | undefined;
    if (typeof start.value === "number") {
      const resolved = resolveSegmentControlPoints({
        start: numeric(i),
        end: numeric(i + 1),
        transitions: { startOut: start.transitions?.out, endIn: end.transitions?.in },
        neighbors: { startPrev: numeric(i - 1), endNext: numeric(i + 2) },
      });
      const cp1 = resolved.cp1Effective ?? resolved.cp1Raw;
      const cp2 = resolved.cp2Effective ?? resolved.cp2Raw;
      if (!cp1 || !cp2) throw new Error(`Missing control points for ${track.id}`);
      bezier = {
        x: [start.stamp, cp1.x, cp2.x, end.stamp],
        y: [start.value, cp1.y, cp2.y, end.value as number],
      };
    }
    return [{ start, end, bezier }];
  });
  const held = (value: SimpleRawValue | undefined): TrackSample => ({
    value: value ?? null,
    velocity: typeof value === "number" ? 0 : null,
  });
  return (worldTimeMs: number): TrackSample => {
    if (!settings.active || track.settings?.muted || points.length === 0) {
      return { value: null, velocity: null };
    }
    const time = computeLocalStamp(worldTimeMs, settings.timescale, settings.offset);
    if (segments.length === 0) return held(points[0].value);
    if (time <= segments[0].start.stamp) return held(segments[0].start.value);
    const last = segments[segments.length - 1];
    if (time >= last.end.stamp) return held(last.end.value);
    const segment = segments.find((s) => time <= s.end.stamp)!;
    // Interior discrete knots hold the left segment, matching Studio's search.
    if (!segment.bezier) return held(segment.start.value);
    const { x, y } = segment.bezier;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 64; i += 1) {
      const mid = (lo + hi) / 2;
      if (cubic(x, mid) < time) lo = mid;
      else hi = mid;
    }
    const u = (lo + hi) / 2;
    const dx = derivative(x, u);
    const dy = derivative(y, u);
    // At a collapsed handle use the first nonzero parametric derivative.
    const second = ([a, b, c, d]: Cubic) => 6 * ((c - 2 * b + a) * (1 - u) + (d - 2 * c + b) * u);
    const third = ([a, b, c, d]: Cubic) => 6 * (d - 3 * c + 3 * b - a);
    const slope =
      dx !== 0 ? dy / dx : second(x) !== 0 ? second(y) / second(x) : third(y) / third(x);
    const velocity = slope * settings.timescale * 1000;
    if (!Number.isFinite(velocity))
      throw new Error(`Non-finite velocity for ${track.id} at ${time}`);
    return { value: cubic(y, u), velocity };
  };
}
