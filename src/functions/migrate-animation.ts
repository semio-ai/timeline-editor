import { RawValue } from "@semio/utils";
import { StoredAnimation, Animation, Track, Keypoint } from "../types";
import { AnimationV1 } from "../types/data/animation";

/**
 * Migrates an animation from an older version (V1) to the latest version (V2).
 *
 * @param animation - The stored animation to migrate.
 * @returns An object containing the migrated animation and a record of tracks.
 */
export function migrateAnimation(animation: StoredAnimation): {
  animation: Animation;
  tracks: Record<string, Track<RawValue>>;
} {
  const tracks: Record<string, Track<RawValue>> = {};
  if (isV1(animation)) {
    // Migrate to the latest version
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

/**
 * Checks if the given animation is of version V1.
 *
 * This simply checks if the animation has a `frames` property.
 *
 * @param animation - The stored animation to check.
 * @returns True if the animation is of version V1, false otherwise.
 */
function isV1(animation: StoredAnimation): animation is AnimationV1 {
  return "frames" in animation;
}
