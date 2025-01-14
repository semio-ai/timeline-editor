import { AnimationInstance } from "../types";

export function computeWorldStamp(localStamp: number, instanceInfo: AnimationInstance): number {
  return localStamp / instanceInfo.settings.timescale + instanceInfo.settings.offset;
}

export function computeLocalStamp(worldStamp: number, instanceInfo: AnimationInstance): number {
  return (worldStamp - instanceInfo.settings.offset) * instanceInfo.settings.timescale;
}
