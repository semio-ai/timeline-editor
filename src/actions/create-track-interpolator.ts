import { piecewise } from "d3-interpolate";
import { scaleLinear } from "d3-scale";
import { isEmpty } from "lodash";
import type { RawValue } from "@semio/utils";
import type { Track, Keypoint, Keyframe, InstanceInfo } from "../types";
import { easeInOutCubic } from "../easings/ease-in-out-cubic";
import { computeWorldStamp } from "./compute-instance-time";

export function createTrackInterpolator(
  track: Track,
  frames: Map<string, Keyframe>,
  points: Map<string, Keypoint<RawValue>>,
  instanceInfo: InstanceInfo,
): (time: number) => RawValue | undefined {
  // TODO: Currently this works in uniformly space time, but our frames are
  // not uniformly spaced. We need to interpolate with respect to the frame time.
  // One option is to rewrite the interpolator to use pairwise adjacent frames, and
  // index into them.
  // The other option is to create a time interpolator as well, and use that to map
  // between the uniform and non-uniform time. See https://github.com/d3/d3-interpolate/issues/81
  // for a discussion on this.
  //
  // If the animation has zero points, always return undefined.
  if (isEmpty(track.points)) {
    return (_time: number) => undefined;
  }
  // If the animation has one point, always return that point's value.
  else if (track.points.length === 1) {
    return (_time: number) => points.get(track.points[0])?.value;
  }

  let valuesByTime = Array<[number, RawValue]>();
  track.points.forEach((pointId: string) => {
    const point: Keypoint<RawValue> | undefined = points.get(pointId);
    if (!point) {
      throw new Error(`Point with id ${pointId} does not exist.`);
    }
    const frame: Keyframe | undefined = frames.get(point.frame);
    if (!frame) {
      throw new Error(`Frame with id ${point.frame} does not exist.`);
    }
    // get the time of the frame relative to the duration of the animation
    const worldStamp = computeWorldStamp(frame.stamp, instanceInfo);

    valuesByTime.push([worldStamp, point.value]);
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
  // valuesByTime.unshift([0, valuesByTime[0][1]]);
  // valuesByTime.push([1, valuesByTime[valuesByTime.length - 1][1]]);
  // console.log(`valuesByTime ${track.name}`, valuesByTime);
  // const bSplineInterpolator = interpolateBasis(
  //   valuesByTime.map((pair) => pair[1]),
  // );

  const interpolator = piecewise(
    easeInOutCubic,
    valuesByTime.map((pair) => pair[1]),
  );

  return (time: number): RawValue => {
    return interpolator(timeInterpolator(time)) as RawValue;
    // return bSplineInterpolator(timeInterpolator(time));
  };
}
