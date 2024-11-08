import { piecewise } from "d3-interpolate";
import { scaleLinear } from "d3-scale";
import { isEmpty } from "lodash";
import type { RawValue } from "@semio/utils";
import type { InstanceInfo, Track } from "../types";
import { easeInOutCubic } from "../easings/ease-in-out-cubic";
import { computeWorldStamp } from "./compute-instance-time";

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
  instanceInfo: InstanceInfo,
): (time: number) => RawValue | undefined {
  // If the animation has zero points, always return undefined.
  if (isEmpty(track.points)) {
    return (_time: number) => undefined;
  }
  // If the animation has one point, always return that point's value.
  else if (track.points.length === 1) {
    return (_time: number) => track.points[0].value;
  }

  let valuesByTime = Array<[number, RawValue]>();
  track.points.forEach((point) => {
    valuesByTime.push([computeWorldStamp(point.stamp, instanceInfo), point.value]);
  });

  // Sort the entries to confirm that they are in order of time.
  valuesByTime = valuesByTime.sort((a, b) => a[0] - b[0]);

  // Add a point at time 0 if the first point is after 0.
  if (valuesByTime[0][0] > 0 && !valuesByTime.map((p) => p[0]).includes(0)) {
    valuesByTime.unshift([0, valuesByTime[0][1]]);
  }
  // Add a point at time 1 if the last point is before 1.
  if (valuesByTime[valuesByTime.length - 1][0] < 1 && !valuesByTime.map((p) => p[0]).includes(1)) {
    valuesByTime.push([1, valuesByTime[valuesByTime.length - 1][1]]);
  }

  const domain = valuesByTime.map((p) => p[0]);
  const range = valuesByTime.map((_, i) => i / (valuesByTime.length - 1));
  const timeInterpolator = scaleLinear().domain(domain).range(range);

  const interpolator = piecewise(
    easeInOutCubic,
    valuesByTime.map((pair) => pair[1]),
  );

  return (time: number): RawValue => {
    return interpolator(timeInterpolator(time)) as RawValue;
  };
}
