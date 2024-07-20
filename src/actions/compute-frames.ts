import type { AnimationData } from "../store-types";
import { InstanceInfo } from "../types";
import { computeWorldStamp } from "./compute-instance-time";

export interface InstancedFrameInfo {
  id: string;
  stamp: number;
  frame: string;
  animation: string;
  namespace: string;
  instanceInfo: InstanceInfo;
}

export function computeFrames(
  state: AnimationData,
  animationIds: string[],
): {
  active: Record<string, InstancedFrameInfo>;
  passive: Record<string, InstancedFrameInfo>;
} {
  const activeFrames: Record<string, InstancedFrameInfo> = {};
  const passiveFrames: Record<string, InstancedFrameInfo> = {};
  // console.log("DEBUG", animationIds, state.animations);
  let active = false;
  animationIds.forEach((animationId) => {
    if (animationId === state.activeAnimation) {
      active = true;
    } else {
      active = false;
    }
    const animation = state.animations[animationId];
    if (!animation) {
      return;
    }
    const uniqueInstances: InstanceInfo[] = [];
    const uniqueInstanceKeys: string[] = [];
    Object.keys(state.animations[animationId]?.instances || {}).forEach(
      (instanceKey: string) => {
        const instanceInfo = animation.instances[instanceKey];
        const existingInstance = uniqueInstances.find(
          (i) =>
            i.offset === instanceInfo.offset &&
            i.timescale === instanceInfo.timescale,
        );
        if (!existingInstance) {
          uniqueInstances.push(instanceInfo);
          uniqueInstanceKeys.push(instanceKey);
        }
      },
    );
    uniqueInstanceKeys.forEach((uniqueInstanceKey, i) => {
      animation.frames.forEach?.((frame) => {
        const entryKey = `${frame.id}-${uniqueInstanceKey}`;
        const worldStamp = computeWorldStamp(frame.stamp, uniqueInstances[i]);
        const instancedFrameInfo = {
          id: entryKey,
          stamp: worldStamp,
          frame: frame.id,
          animation: animationId,
          namespace: uniqueInstanceKey,
          instanceInfo: uniqueInstances[i],
        };
        if (active) {
          activeFrames[entryKey] = instancedFrameInfo;
        } else {
          passiveFrames[entryKey] = instancedFrameInfo;
        }
      });
    });
  });
  return { active: activeFrames, passive: passiveFrames };
}
