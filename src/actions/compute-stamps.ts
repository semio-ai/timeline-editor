import { uniq } from "lodash";
import type { AnimationData } from "../store-types";

export function computeStamps(
  state: AnimationData,
  animationIds: string[],
): number[] {
  let stamps: number[] = [];
  animationIds.forEach((animationId) => {
    Object.values(state.animations[animationId].instances).forEach(
      ({ offset, timescale }) => {
        stamps = [
          ...stamps,
          ...state.animations[animationId].frameOrder.map(
            (frameId) =>
              ((state.animations[animationId].frames.get(frameId)?.stamp ?? 0) +
                offset) /
              timescale,
          ),
        ];
      },
    );
  });
  return uniq(stamps.sort((a, b) => a - b));
}
