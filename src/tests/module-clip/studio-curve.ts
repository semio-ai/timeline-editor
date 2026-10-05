import { resolveSegmentControlPoints } from "../../functions/resolve-segment-control-points";
import type { SimpleRawValue, SimpleTrack } from "../../types/data/simple-track";

/**
 * What a Studio track plays at a local time, evaluated exactly: the segments
 * and control points `computeTrackInterpolator` builds, with a numeric
 * segment's Bézier parameter solved to double precision rather than by the
 * interpolator's twelve bisection steps, and a string or boolean segment
 * holding its start value as the interpolator's step branch does. The oracle
 * the module is held to.
 *
 * Strings need it: the interpolator offsets every segment's start value by
 * its handle delta (`rawValueAdd`), which throws for a string, so it cannot
 * evaluate a string track of two stamps or more.
 */
export function studioCurve(track: SimpleTrack): (timeMs: number) => SimpleRawValue {
  const points = [...track.points].sort((a, b) => a.stamp - b.stamp);
  const numeric = (i: number) => {
    const point = points[i];
    return point && { stamp: point.stamp, value: point.value as number };
  };

  interface Segment {
    start: number;
    end: number;
    startValue: SimpleRawValue;
    endValue: SimpleRawValue;
    bezier?: { xs: number[]; ys: number[] };
  }
  const segments: Segment[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const [start, end] = [points[i], points[i + 1]];
    if (start.stamp === end.stamp) continue;
    const segment: Segment = {
      start: start.stamp,
      end: end.stamp,
      startValue: start.value,
      endValue: end.value,
    };
    if (typeof start.value === "number") {
      const resolved = resolveSegmentControlPoints({
        start: numeric(i),
        end: numeric(i + 1),
        transitions: { startOut: start.transitions?.out, endIn: end.transitions?.in },
        neighbors: { startPrev: numeric(i - 1), endNext: numeric(i + 2) },
      });
      const cp1 = resolved.cp1Effective ?? resolved.cp1Raw;
      const cp2 = resolved.cp2Effective ?? resolved.cp2Raw;
      if (!cp1 || !cp2) throw new Error(`segment ${i} of ${track.id} has no control points`);
      segment.bezier = {
        xs: [start.stamp, cp1.x, cp2.x, end.stamp],
        ys: [start.value, cp1.y, cp2.y, end.value as number],
      };
    }
    segments.push(segment);
  }
  if (segments.length === 0) return () => points[0].value;

  return (timeMs) => {
    if (timeMs <= segments[0].start) return segments[0].startValue;
    const index = segments.findIndex((s) => timeMs <= s.end);
    if (index === -1) return segments[segments.length - 1].endValue;
    const segment = segments[index];
    if (!segment.bezier) return segment.startValue;
    const { xs, ys } = segment.bezier;
    let lo = 0;
    let hi = 1;
    for (let k = 0; k < 64; k += 1) {
      const mid = (lo + hi) / 2;
      if (cubic(xs, mid) < timeMs) lo = mid;
      else hi = mid;
    }
    return cubic(ys, (lo + hi) / 2);
  };
}

function cubic([p0, p1, p2, p3]: number[], s: number): number {
  const m = 1 - s;
  return p0 * m * m * m + 3 * p1 * m * m * s + 3 * p2 * m * s * s + p3 * s * s * s;
}
