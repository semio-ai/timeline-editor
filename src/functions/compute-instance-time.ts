import { InstanceInfo } from "../types";

export function computeWorldStamp(localStamp: number, instanceInfo: InstanceInfo): number {
  return localStamp / instanceInfo.timescale + instanceInfo.offset;
}

export function computeLocalStamp(worldStamp: number, instanceInfo: InstanceInfo): number {
  return (worldStamp - instanceInfo.offset) * instanceInfo.timescale;
}
