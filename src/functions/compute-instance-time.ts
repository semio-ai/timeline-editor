import type { RowTime } from "../types";

export function computeWorldStamp(localStamp: number, timescale: number, offset: number): number {
  return localStamp / timescale + offset;
}

export function computeLocalStamp(worldStamp: number, timescale: number, offset: number): number {
  return (worldStamp - offset) * timescale;
}

/** A stamp of a row in world time: through the row's time, if it has one. */
export function worldStampOf(time: RowTime | undefined, stamp: number): number {
  return time ? computeWorldStamp(stamp, time.timescale, time.offset) : stamp;
}

/** A world-time stamp in a row's time. */
export function rowStampOf(time: RowTime | undefined, worldStamp: number): number {
  return time ? computeLocalStamp(worldStamp, time.timescale, time.offset) : worldStamp;
}
