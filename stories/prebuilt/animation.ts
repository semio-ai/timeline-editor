import type { AnimatableValue } from "@semio/data";
import { randomHexString } from "@semio/utils";
import { createDefaultState, createDefaultAnimation, addAnimation } from "@semio/timeline-editor";
import type {
  AnimationData,
  StoredAnimation,
  AnimationInstance,
  Track,
  Keypoint,
} from "@semio/timeline-editor";

export function createTestAnimationState(trackCount: number, keysPerTrack: number): AnimationData {
  const state = createDefaultState();
  const animation: StoredAnimation = createDefaultAnimation();
  animation.duration = 10000;
  addAnimation(state, animation);

  for (let i = 0; i < trackCount; i++) {
    // Create an animatable to target
    const bounds = [(Math.random() - 0.5) * 1000, (Math.random() - 0.5) * 1000].sort(
      (a, b) => a - b,
    );
    const animatable: AnimatableValue = {
      id: crypto.randomUUID(),
      type: "number",
      name: `Animatable ${(i + 1).toString()}`,
      default: Math.random() * (bounds[1] - bounds[0]) + bounds[0],
      constraints: {
        min: bounds[0],
        max: bounds[1],
      },
    };
    state.animatables[animatable.id] = animatable;

    // Create the track;
    const track: Track<number> = {
      id: crypto.randomUUID(),
      name: `Track ${(i + 1).toString()}`,
      animatableId: animatable.id,
      points: [],
      settings: {
        color: randomHexString(0.7, 0.7),
      },
    };

    // Add points to the track;
    const points: Keypoint<number>[] = [];
    for (let j = 0; j < keysPerTrack; j++) {
      const stamp = Math.random();
      const value = Math.random() * (bounds[1] - bounds[0]) + bounds[0];
      const point: Keypoint<number> = {
        id: crypto.randomUUID(),
        stamp,
        value,
      };
      points.push(point);
    }
    points.sort((a, b) => a.stamp - b.stamp);

    track.points = points;

    state.tracks[track.id] = track;
    state.animations[animation.id].tracks.push(track.id);
  }

  const animationInstance: AnimationInstance = {
    id: crypto.randomUUID(),
    animationId: animation.id,
    settings: {
      active: true,
      offset: 0,
      timescale: 1,
    },
  };

  const namespaceId = "default";
  const namespaces = {
    [namespaceId]: {
      id: namespaceId,
      name: "Default",
      animationInstances: {
        [animationInstance.id]: animationInstance,
      },
    },
  };

  state.namespaces = namespaces;

  return state;
}
