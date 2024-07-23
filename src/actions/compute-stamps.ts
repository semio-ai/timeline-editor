import { uniq } from "lodash";
import type { AnimationData } from "../store-types";
import { computeWorldStamp } from "./compute-instance-time";

export function computeStamps(
  state: AnimationData,
  animationIds: string[],
): number[] {
  let stamps: number[] = [];
  // console.log("DEBUG", animationIds, state.animations);
  animationIds.forEach((animationId) => {
    // console.log(state.animations[animationId]);
    Object.values(state.animations[animationId]?.instances || {}).forEach(
      (instanceInfo) => {
        stamps = [
          ...stamps,
          ...state.animations[animationId].frameOrder.map((frameId) =>
            computeWorldStamp(
              state.animations[animationId].frames.get(frameId)?.stamp ?? 0,
              instanceInfo,
            ),
          ),
        ];
      },
    );
  });
  return uniq(stamps.sort((a, b) => a - b));
}
