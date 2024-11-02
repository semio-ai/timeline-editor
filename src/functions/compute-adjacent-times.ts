import { RawValue } from "@semio/utils";
import type { Track, InstanceInfo } from "../types";
import { computeStamps } from "./compute-stamps";

export function computeNextTime(
  tracks: Record<string, Track<RawValue>>,
  instances: Record<string, InstanceInfo>,
  stamp: number,
  bounds: [number, number],
  respectBounds: boolean,
): number | undefined {
  const allStamps = computeStamps(tracks, instances);
  const nextStamp = respectBounds
    ? allStamps.find((s) => s > stamp && s <= bounds[1])
    : allStamps.find((s) => s > stamp);
  return nextStamp;
}

export function computePreviousTime(
  tracks: Record<string, Track<RawValue>>,
  instances: Record<string, InstanceInfo>,
  stamp: number,
  bounds: [number, number],
  respectBounds: boolean,
): number | undefined {
  const allStamps = computeStamps(tracks, instances);
  const nextStamp = respectBounds
    ? allStamps.reverse().find((s) => s < stamp && s >= bounds[0])
    : allStamps.reverse().find((s) => s < stamp);
  return nextStamp;
}
