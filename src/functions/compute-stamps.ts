import { uniq } from "lodash";
import { RawValue } from "@semio/utils";
import type { Track, InstanceInfo } from "../types";
import { computeWorldStamp } from "./compute-instance-time";

export function computeStamps(
  tracks: Record<string, Track<RawValue>>,
  instances: Record<string, InstanceInfo>,
): number[] {
  const stamps: number[] = [];
  Object.values(instances).forEach((instanceInfo) => {
    Object.values(tracks).forEach((track) => {
      track.points.forEach((point) => {
        stamps.push(computeWorldStamp(point.stamp, instanceInfo));
      });
    });
  });
  return uniq(stamps.sort((a, b) => a - b));
}
