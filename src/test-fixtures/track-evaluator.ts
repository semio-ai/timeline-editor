import type { TrackEvaluator } from "../functions/track-curve";
import type { ClipTrack } from "../functions/stored-animation-format";
import type { SimpleTrack } from "../types/data/simple-track";
import { referenceCurve } from "./reference-curve";

/** Test/story evaluator using Studio's segment resolver and 64-step bisection in ms. */
export const testTrackEvaluator: TrackEvaluator = {
  compile(trackJson) {
    const document = JSON.parse(trackJson) as ClipTrack;
    const track: SimpleTrack = {
      ...document,
      points: document.points.map((point) => ({
        id: point.id,
        stamp: point.timeNs / 1e6,
        value: point.value,
        transitions: point.transitions && {
          in:
            typeof point.transitions.in === "object"
              ? { x: point.transitions.in.dtNs / 1e6, y: point.transitions.in.dv }
              : point.transitions.in,
          out:
            typeof point.transitions.out === "object"
              ? { x: point.transitions.out.dtNs / 1e6, y: point.transitions.out.dv }
              : point.transitions.out,
          pairing: point.transitions.pairing,
        },
      })),
    };
    const sample = referenceCurve(track, { active: true, timescale: 1, offset: 0 });
    const kind = track.points.length ? typeof track.points[0].value : undefined;
    return {
      kind,
      values: (times) => {
        if (kind === "number")
          return Float64Array.from(times, (time) => sample(time).value as number);
        return Array.from(times, (time) => sample(time).value as boolean | string);
      },
      velocities: (times) =>
        kind === "number" ? Float64Array.from(times, (time) => sample(time).velocity!) : undefined,
      numbers: (times) =>
        kind === "number"
          ? Float64Array.from({ length: times.length * 2 }, (_, i) =>
              i < times.length
                ? (sample(times[i]).value as number)
                : sample(times[i - times.length]).velocity!,
            )
          : undefined,
      numberAt: (time) => (kind === "number" ? (sample(time).value as number) : NaN),
      velocityAt: (time) => (kind === "number" ? sample(time).velocity! : NaN),
      polyline: (starts, ends, count) => {
        if (kind !== "number") return undefined;
        const points = new Float64Array(starts.length * count * 2);
        starts.forEach((start, range) => {
          for (let i = 0; i < count; i += 1) {
            const time =
              i === count - 1 ? ends[range] : start + ((ends[range] - start) * i) / (count - 1);
            points[(range * count + i) * 2] = time;
            points[(range * count + i) * 2 + 1] = sample(time).value as number;
          }
        });
        return points;
      },
      free() {},
    };
  },
};
