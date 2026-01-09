import { isEmpty } from "lodash";
import type { RawValue, RawVector3, RawVector2, RawEuler, RawRGB, RawHSL } from "@semio/utils";
import {
  instanceOfRawVector3,
  instanceOfRawVector2,
  instanceOfRawEuler,
  instanceOfRawRGB,
  instanceOfRawHSL,
} from "@semio/utils";
import type { AnimationInstance, Track, StandardTransitionType } from "../types";
import { computeWorldStamp } from "./compute-instance-time";
import { getWorldControlPoints } from "./get-world-control-points";
import { resolveSegmentControlPoints } from "./resolve-segment-control-points";
import { coerceNumericValue } from "./segment-value-utils";

const PARAMETER_SOLVE_MAX_ITERATIONS = 12;
const PARAMETER_SOLVE_EPSILON = 1e-4;

interface TrackPoint {
  time: number;
  value: RawValue;
  transitions?: {
    in?: RawVector2 | StandardTransitionType;
    out?: RawVector2 | StandardTransitionType;
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
    const startNumeric = coerceNumericValue(start.value);
    const endNumeric = coerceNumericValue(end.value);
    const hasNumeric = startNumeric !== undefined && endNumeric !== undefined;

    if (hasNumeric) {
      const controlPoints = resolveSegmentControlPoints({
        start: { stamp: start.time, value: startNumeric },
        end: { stamp: end.time, value: endNumeric },
        transitions: {
          startOut: start.transitions?.out,
          endIn: end.transitions?.in,
        },
      });
      const cp1 = controlPoints.cp1Effective ?? controlPoints.cp1Raw;
      const cp2 = controlPoints.cp2Effective ?? controlPoints.cp2Raw;
      if (cp1 && cp2) {
        segments.push({
          startTime: start.time,
          endTime: end.time,
          cp1Time: cp1.x,
          cp2Time: cp2.x,
          startValue: start.value,
          cp1Value: cp1.y,
          cp2Value: cp2.y,
          endValue: end.value,
        });
        continue;
      }
    }

    const { start: cp1World, end: cp2World } = getWorldControlPoints(
      start.time,
      end.time,
      start.value,
      end.value,
      start.transitions,
      end.transitions,
    );

    segments.push({
      startTime: start.time,
      endTime: end.time,
      cp1Time: cp1World.x,
      cp2Time: cp2World.x,
      startValue: start.value,
      cp1Value: cp1World.y,
      cp2Value: cp2World.y,
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
