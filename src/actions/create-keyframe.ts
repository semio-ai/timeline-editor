import { intersection } from "lodash";
import type { AnimationData } from "../store-types";
import type { Keyframe, Keypoint, Track } from "../types";
import { RawValue } from "@semio/utils";

export function createKeyframe(
  state: AnimationData,
  animationId: string,
  keyframe: Partial<Keyframe>,
  fillPoints?: boolean,
): Keyframe {
  const id = crypto.randomUUID();
  const stamp = state.player.stamp;
  const completekeyframe: Keyframe = {
    ...(state.animations[animationId].frames.get(
      state.selectedKeyframe ?? "",
    ) ?? {
      stamp,
      id,
      points: [],
    }),
    ...keyframe,
    points: [...(keyframe.points ?? [])],
  };

  if (fillPoints) {
    state.animations[animationId].tracks.forEach((track: Track) => {
      if (track.points.some((p) => completekeyframe.points.includes(p))) {
        // if the track has points that are in the existing keyframe, ignore
      } else {
        // if the track does not have points that exist in the keyframe, create/add them
        const newPoint: Keypoint<RawValue> = {
          id: crypto.randomUUID(),
          value: state.values.get(track.id) ?? 0,
          frame: completekeyframe.id,
          track: track.id,
        };
        state.animations[animationId].points.set(newPoint.id, newPoint);
        completekeyframe.points.push(newPoint.id);
        track.points.push(newPoint.id);
        state.animations[animationId].tracks.set(track.id, track);
      }
    });
  }

  // Insert the keyframe into the correct position based on time
  const index = state.animations[animationId].frameOrder.findIndex(
    (frameId) =>
      (state.animations[animationId].frames.get(frameId)?.stamp || -1) > stamp,
  );
  // insert the frame at that index
  state.animations[animationId].frameOrder.splice(index, 0, id);
  state.animations[animationId].frames.set(id, completekeyframe);

  return completekeyframe;
}
