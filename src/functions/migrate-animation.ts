import { RawValue } from "@semio/utils";
import { StoredAnimation, Animation, Track, Keypoint } from "../types";
import { AnimationV1 } from "../types/data/animation";

export function migrateAnimation(animation: StoredAnimation): {
  animation: Animation;
  tracks: Record<string, Track<RawValue>>;
} {
  const tracks: Record<string, Track<RawValue>> = {};
  if (isV1(animation)) {
    // Migrate to the latest version
    console.log("Migrating animation from V1 to V2");
    animation.trackOrder.forEach((track) => {
      const trackData = animation.tracks.get(track);
      if (trackData) {
        tracks[track] = {
          id: trackData.id,
          name: trackData.name,
          points: trackData.points
            .map((point) => {
              const pointData = animation.points.get(point);
              const frameData = animation.frames.get(pointData?.frame ?? "");
              if (pointData && frameData) {
                return {
                  id: point,
                  stamp: frameData.stamp,
                  value: pointData.value as RawValue,
                } as Keypoint<RawValue>;
              } else {
                return undefined;
              }
            })
            .filter((p) => p !== undefined) as Keypoint<RawValue>[],
        } as Track<RawValue>;
      }
    });
    return {
      animation: {
        id: animation.id,
        name: animation.name,
        tracks: animation.trackOrder,
        groups: animation.groups,
        transitions: animation.transitions,
        duration: animation.duration,
        instances: animation.instances,
      },
      tracks,
    };
  } else {
    console.log("Animation is already V2", animation);
    return {
      animation: {
        id: animation.id,
        name: animation.name,
        tracks: animation.tracks.map((t) => t.id),
        groups: animation.groups,
        transitions: animation.transitions,
        duration: animation.duration,
        instances: animation.instances,
      },
      tracks: animation.tracks.reduce((acc, track) => ({ ...acc, [track.id]: track }), {}),
    };
  }
}

function isV1(animation: StoredAnimation): animation is AnimationV1 {
  return "frames" in animation;
}
