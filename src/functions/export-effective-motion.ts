import type { AnimatableValue, RawValue } from "@semio/utils";
import type { Animation, Track } from "../types";
import { resolveSegmentControlPoints } from "./resolve-segment-control-points";

export interface EffectiveMotionHandle {
  deltaTimeMs: number;
  deltaValue: number;
}

export interface EffectiveMotionKey {
  timeMs: number;
  value: number;
  in?: EffectiveMotionHandle;
  out?: EffectiveMotionHandle;
}

export interface EffectiveMotionChannel {
  output: string;
  units: string;
  keys: EffectiveMotionKey[];
}

export interface EffectiveMotionExport {
  format: "semio-effective-motion";
  version: 1;
  animationName: string;
  timeBasis: "animation-local";
  timeUnit: "ms";
  channels: EffectiveMotionChannel[];
}

/** Playback clamps belong in the exported geometry so external sampling follows the played curve. */
export function exportEffectiveMotion(
  animation: Animation,
  tracks: Record<string, Track<RawValue>>,
  animatables: Record<string, AnimatableValue>,
): EffectiveMotionExport {
  const channels: EffectiveMotionChannel[] = [];
  const outputs = new Set<string>();

  for (const trackId of animation.tracks) {
    const track = tracks[trackId];
    if (!track) throw new Error(`Track ${trackId} is not loaded`);
    if (track.settings?.muted || track.points.length === 0) continue;

    const animatable = animatables[track.animatableId];
    if (animatable && animatable.pub?.public !== true) continue;
    const output = animatable?.pub?.output?.trim();
    if (!output) throw new Error(`Track "${track.name}" has no resolved output name`);
    if (outputs.has(output)) throw new Error(`Multiple tracks target "${output}"`);
    if (animatable.type !== "number") {
      throw new Error(`Track "${track.name}" is not a numeric channel`);
    }
    const units = animatable.pub?.units?.trim();
    if (!units) throw new Error(`Track "${track.name}" has no output units`);

    const points = [...track.points].sort((a, b) => a.stamp - b.stamp);
    const keys: EffectiveMotionKey[] = points.map((point) => {
      if (typeof point.value !== "number" || !Number.isFinite(point.value) || !Number.isFinite(point.stamp)) {
        throw new Error(`Track "${track.name}" contains a non-finite numeric key`);
      }
      return { timeMs: point.stamp, value: point.value };
    });

    for (let i = 0; i < points.length - 1; i += 1) {
      const start = keys[i];
      const end = keys[i + 1];
      if (start.timeMs === end.timeMs) {
        throw new Error(`Track "${track.name}" contains simultaneous keys`);
      }
      const resolved = resolveSegmentControlPoints({
        start: { stamp: start.timeMs, value: start.value },
        end: { stamp: end.timeMs, value: end.value },
        transitions: {
          startOut: points[i].transitions?.out,
          endIn: points[i + 1].transitions?.in,
        },
        neighbors: {
          startPrev: i > 0 ? { stamp: keys[i - 1].timeMs, value: keys[i - 1].value } : undefined,
          endNext: i + 2 < keys.length ? { stamp: keys[i + 2].timeMs, value: keys[i + 2].value } : undefined,
        },
      });
      const cp1 = resolved.cp1Effective ?? resolved.cp1Raw;
      const cp2 = resolved.cp2Effective ?? resolved.cp2Raw;
      if (!cp1 || !cp2) throw new Error(`Track "${track.name}" has an unresolved curve`);
      if (![cp1.x, cp1.y, cp2.x, cp2.y].every(Number.isFinite)) {
        throw new Error(`Track "${track.name}" has non-finite curve control points`);
      }
      start.out = { deltaTimeMs: cp1.x - start.timeMs, deltaValue: cp1.y - start.value };
      end.in = { deltaTimeMs: cp2.x - end.timeMs, deltaValue: cp2.y - end.value };
      if (![start.out.deltaTimeMs, start.out.deltaValue, end.in.deltaTimeMs, end.in.deltaValue].every(Number.isFinite)) {
        throw new Error(`Track "${track.name}" has non-finite curve handle offsets`);
      }
    }

    outputs.add(output);
    channels.push({ output, units, keys });
  }

  if (channels.length === 0) throw new Error("Animation has no playable numeric tracks");
  return {
    format: "semio-effective-motion",
    version: 1,
    animationName: animation.name,
    timeBasis: "animation-local",
    timeUnit: "ms",
    channels,
  };
}
