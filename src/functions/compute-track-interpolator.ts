import { isEmpty } from "lodash";
import type { RawValue, RawVector3, RawVector2, RawEuler, RawRGB, RawHSL } from "@semio/utils";
import {
  instanceOfRawVector3,
  instanceOfRawVector2,
  instanceOfRawEuler,
  instanceOfRawRGB,
  instanceOfRawHSL,
} from "@semio/utils";
import type { AnimationInstance, Track } from "../types";
import { computeWorldStamp } from "./compute-instance-time";

const DEFAULT_TRANSITION_OUT = { x: 0.65, y: 0 };
const DEFAULT_TRANSITION_IN = { x: 0.35, y: 1 };
const PARAMETER_SOLVE_MAX_ITERATIONS = 12;
const PARAMETER_SOLVE_EPSILON = 1e-4;

interface TrackPoint {
  time: number;
  value: RawValue;
  transitions?: {
    in?: { x: number; y: number };
    out?: { x: number; y: number };
  };
}

interface BezierSegment {
  startTime: number;
  endTime: number;
  cp1Time: number;
  cp2Time: number;
  startValue: RawValue;
  cp1Value: RawValue;
  cp2Value: RawValue;
  endValue: RawValue;
}

/**
 * Computes an interpolator function for a given track and instance information.
 * The returned function takes a time value and returns the interpolated value at that time.
 *
 * @param track - The track containing points with time stamps and values.
 * @param instanceInfo - Information about the instance to compute world stamps.
 * @returns A function that takes a time value (number) and returns the interpolated value (RawValue) at that time, or undefined if the track has no points.
 */
export function computeTrackInterpolator(
  track: Track<RawValue>,
  instanceInfo: AnimationInstance,
): (time: number) => RawValue | undefined {
  // If the animation has zero points, always return undefined.
  if (isEmpty(track.points)) {
    return (_time: number) => undefined;
  }
  // If the animation has one point, always return that point's value.
  else if (track.points.length === 1) {
    return (_time: number) => track.points[0].value;
  }

  const points: TrackPoint[] = track.points
    .map((point) => ({
      time: computeWorldStamp(
        point.stamp,
        instanceInfo.settings.timescale,
        instanceInfo.settings.offset,
      ),
      value: point.value,
      transitions: point.transitions,
    }))
    .sort((a, b) => a.time - b.time);

  const segments: BezierSegment[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const start = points[i];
    const end = points[i + 1];
    if (start.time === end.time) {
      continue;
    }
    const cp1Raw = start.transitions?.out ?? DEFAULT_TRANSITION_OUT;
    const cp2Raw = end.transitions?.in ?? DEFAULT_TRANSITION_IN;

    const cp1Time = start.time + (end.time - start.time) * clampControlX(cp1Raw.x);
    const cp2Time = start.time + (end.time - start.time) * clampControlX(cp2Raw.x);

    const cp1Value = computeControlValue(start.value, end.value, cp1Raw.y);
    const cp2Value = computeControlValue(start.value, end.value, cp2Raw.y);

    segments.push({
      startTime: start.time,
      endTime: end.time,
      cp1Time,
      cp2Time,
      startValue: start.value,
      cp1Value,
      cp2Value,
      endValue: end.value,
    });
  }

  if (segments.length === 0) {
    const firstPoint = points[0];
    return (_time: number) => firstPoint.value;
  }

  const { timescale, offset } = instanceInfo.settings;

  return (time: number): RawValue | undefined => {
    const worldTime = computeWorldStamp(time, timescale, offset);

    if (worldTime <= segments[0].startTime) {
      return segments[0].startValue;
    }

    let previousSegment: BezierSegment | undefined;
    for (const segment of segments) {
      if (worldTime < segment.startTime) {
        return previousSegment ? previousSegment.endValue : segment.startValue;
      }
      if (worldTime <= segment.endTime) {
        const parameter = solveForParameter(segment, worldTime);
        return evaluateSegmentValue(segment, parameter);
      }
      previousSegment = segment;
    }

    const last = segments[segments.length - 1];
    return last.endValue;
  };
}

function clampControlX(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function computeControlValue(start: RawValue, end: RawValue, weight: number): RawValue {
  if (typeof start === "number" && typeof end === "number") {
    return start + (end - start) * weight;
  }

  if (instanceOfRawVector3(start) && instanceOfRawVector3(end)) {
    return {
      x: start.x + (end.x - start.x) * weight,
      y: start.y + (end.y - start.y) * weight,
      z: start.z + (end.z - start.z) * weight,
    } as RawVector3;
  }

  if (instanceOfRawEuler(start) && instanceOfRawEuler(end)) {
    return {
      r: start.r + (end.r - start.r) * weight,
      p: start.p + (end.p - start.p) * weight,
      y: start.y + (end.y - start.y) * weight,
    } as RawEuler;
  }

  if (instanceOfRawVector2(start) && instanceOfRawVector2(end)) {
    return {
      x: start.x + (end.x - start.x) * weight,
      y: start.y + (end.y - start.y) * weight,
    } as RawVector2;
  }

  if (instanceOfRawRGB(start) && instanceOfRawRGB(end)) {
    return {
      r: start.r + (end.r - start.r) * weight,
      g: start.g + (end.g - start.g) * weight,
      b: start.b + (end.b - start.b) * weight,
    } as RawRGB;
  }

  if (instanceOfRawHSL(start) && instanceOfRawHSL(end)) {
    return {
      h: start.h + (end.h - start.h) * weight,
      s: start.s + (end.s - start.s) * weight,
      l: start.l + (end.l - start.l) * weight,
    } as RawHSL;
  }

  if (typeof start === "string" && typeof end === "string") {
    return weight < 1 ? start : end;
  }

  if (typeof start === "boolean" && typeof end === "boolean") {
    return weight < 1 ? start : end;
  }

  return weight <= 0 ? start : end;
}

function evaluateSegmentValue(segment: BezierSegment, parameter: number): RawValue {
  if (typeof segment.startValue === "number") {
    return evaluateBezierScalar(
      segment.startValue as number,
      segment.cp1Value as number,
      segment.cp2Value as number,
      segment.endValue as number,
      parameter,
    );
  }

  if (
    instanceOfRawVector3(segment.startValue) &&
    instanceOfRawVector3(segment.cp1Value) &&
    instanceOfRawVector3(segment.cp2Value) &&
    instanceOfRawVector3(segment.endValue)
  ) {
    return {
      x: evaluateBezierScalar(
        segment.startValue.x,
        segment.cp1Value.x,
        segment.cp2Value.x,
        segment.endValue.x,
        parameter,
      ),
      y: evaluateBezierScalar(
        segment.startValue.y,
        segment.cp1Value.y,
        segment.cp2Value.y,
        segment.endValue.y,
        parameter,
      ),
      z: evaluateBezierScalar(
        segment.startValue.z,
        segment.cp1Value.z,
        segment.cp2Value.z,
        segment.endValue.z,
        parameter,
      ),
    } as RawVector3;
  }

  if (
    instanceOfRawEuler(segment.startValue) &&
    instanceOfRawEuler(segment.cp1Value) &&
    instanceOfRawEuler(segment.cp2Value) &&
    instanceOfRawEuler(segment.endValue)
  ) {
    return {
      r: evaluateBezierScalar(
        segment.startValue.r,
        segment.cp1Value.r,
        segment.cp2Value.r,
        segment.endValue.r,
        parameter,
      ),
      p: evaluateBezierScalar(
        segment.startValue.p,
        segment.cp1Value.p,
        segment.cp2Value.p,
        segment.endValue.p,
        parameter,
      ),
      y: evaluateBezierScalar(
        segment.startValue.y,
        segment.cp1Value.y,
        segment.cp2Value.y,
        segment.endValue.y,
        parameter,
      ),
    } as RawEuler;
  }

  if (
    instanceOfRawVector2(segment.startValue) &&
    instanceOfRawVector2(segment.cp1Value) &&
    instanceOfRawVector2(segment.cp2Value) &&
    instanceOfRawVector2(segment.endValue)
  ) {
    return {
      x: evaluateBezierScalar(
        segment.startValue.x,
        segment.cp1Value.x,
        segment.cp2Value.x,
        segment.endValue.x,
        parameter,
      ),
      y: evaluateBezierScalar(
        segment.startValue.y,
        segment.cp1Value.y,
        segment.cp2Value.y,
        segment.endValue.y,
        parameter,
      ),
    } as RawVector2;
  }

  if (
    instanceOfRawRGB(segment.startValue) &&
    instanceOfRawRGB(segment.cp1Value) &&
    instanceOfRawRGB(segment.cp2Value) &&
    instanceOfRawRGB(segment.endValue)
  ) {
    return {
      r: evaluateBezierScalar(
        segment.startValue.r,
        segment.cp1Value.r,
        segment.cp2Value.r,
        segment.endValue.r,
        parameter,
      ),
      g: evaluateBezierScalar(
        segment.startValue.g,
        segment.cp1Value.g,
        segment.cp2Value.g,
        segment.endValue.g,
        parameter,
      ),
      b: evaluateBezierScalar(
        segment.startValue.b,
        segment.cp1Value.b,
        segment.cp2Value.b,
        segment.endValue.b,
        parameter,
      ),
    } as RawRGB;
  }

  if (
    instanceOfRawHSL(segment.startValue) &&
    instanceOfRawHSL(segment.cp1Value) &&
    instanceOfRawHSL(segment.cp2Value) &&
    instanceOfRawHSL(segment.endValue)
  ) {
    return {
      h: evaluateBezierScalar(
        segment.startValue.h,
        segment.cp1Value.h,
        segment.cp2Value.h,
        segment.endValue.h,
        parameter,
      ),
      s: evaluateBezierScalar(
        segment.startValue.s,
        segment.cp1Value.s,
        segment.cp2Value.s,
        segment.endValue.s,
        parameter,
      ),
      l: evaluateBezierScalar(
        segment.startValue.l,
        segment.cp1Value.l,
        segment.cp2Value.l,
        segment.endValue.l,
        parameter,
      ),
    } as RawHSL;
  }

  if (typeof segment.startValue === "string" && typeof segment.endValue === "string") {
    return parameter < 1 ? segment.startValue : segment.endValue;
  }

  if (typeof segment.startValue === "boolean" && typeof segment.endValue === "boolean") {
    return parameter < 1 ? segment.startValue : segment.endValue;
  }

  // Fallback for unsupported types: snap to nearest endpoint.
  return parameter < 1 ? segment.startValue : segment.endValue;
}

function evaluateBezierScalar(
  start: number,
  cp1: number,
  cp2: number,
  end: number,
  t: number,
): number {
  const mt = 1 - t;
  return start * mt * mt * mt + 3 * cp1 * mt * mt * t + 3 * cp2 * mt * t * t + end * t * t * t;
}

function solveForParameter(segment: BezierSegment, time: number): number {
  if (segment.endTime === segment.startTime) {
    return 0;
  }
  let low = 0;
  let high = 1;
  let mid = 0;
  for (let i = 0; i < PARAMETER_SOLVE_MAX_ITERATIONS; i += 1) {
    mid = (low + high) / 2;
    const estimate = evaluateBezierScalar(
      segment.startTime,
      segment.cp1Time,
      segment.cp2Time,
      segment.endTime,
      mid,
    );
    if (Math.abs(estimate - time) < PARAMETER_SOLVE_EPSILON) {
      return mid;
    }
    if (estimate < time) {
      low = mid;
    } else {
      high = mid;
    }
  }
  return (low + high) / 2;
}
