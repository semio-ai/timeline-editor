import { describe, expect, test } from "vitest";
import { usePlayerStore, useValuesStore } from "@semio/utils";
import { computeLocalStamp, computeTrackInterpolator, computeWorldStamp } from "../../functions";
import { resolveAnimationDuration } from "../../functions/compute-animation-extent";
import { buildTrackKey } from "../../utils/track-key";
import {
  ANIMATABLE_IDS,
  INSTANCE_IDS,
  NAMESPACE_IDS,
  TRACK_IDS,
  createTestAnimationStore,
} from "../../test-fixtures/animation-store-factory";

describe("values timescale behavior", () => {
  test("samples values using local stamps derived from instance transforms", () => {
    const player = usePlayerStore.getState();
    const previousStamp = player.player.stamp;
    const worldStamp = 0.4;

    player.resetPlayer(worldStamp);

    try {
      const store = createTestAnimationStore();
      const state = store.getState();
      const animatable = state.animatables[ANIMATABLE_IDS.SCALE];
      const track = state.tracks[TRACK_IDS.SCALE];
      const instance =
        state.namespaces[NAMESPACE_IDS.BETA]?.animationInstances?.[INSTANCE_IDS.BETA_SHARED];

      if (!animatable || !track || !instance) {
        throw new Error("Missing fixture data for values timescale test");
      }
      if (animatable.type !== "number") {
        throw new Error("Expected number animatable for values timescale test");
      }

      const interpolator = computeTrackInterpolator(track, instance);
      const localStamp = computeLocalStamp(
        worldStamp,
        instance.settings.timescale,
        instance.settings.offset,
      );
      const expected = interpolator(localStamp) ?? animatable.default;

      const lookup = buildTrackKey(NAMESPACE_IDS.BETA, INSTANCE_IDS.BETA_SHARED, TRACK_IDS.SCALE);
      const actual = useValuesStore.getState().values.get(lookup);

      if (typeof expected !== "number" || typeof actual !== "number") {
        throw new Error("Expected numeric values for values timescale test");
      }

      expect(actual).toBeCloseTo(expected);
    } finally {
      player.resetPlayer(previousStamp);
    }
  });

  test("holds the first keypoint value until the transformed start time", () => {
    const player = usePlayerStore.getState();
    const previousStamp = player.player.stamp;

    try {
      const store = createTestAnimationStore();
      const state = store.getState();
      const track = state.tracks[TRACK_IDS.SCALE];
      const instance =
        state.namespaces[NAMESPACE_IDS.BETA]?.animationInstances?.[INSTANCE_IDS.BETA_SHARED];

      if (!track || !instance) {
        throw new Error("Missing fixture data for values timescale pre-start test");
      }

      const firstPoint = [...track.points].sort((a, b) => a.stamp - b.stamp)[0];
      const timescale = instance.settings.timescale;
      const offset = instance.settings.offset;
      const worldStart = computeWorldStamp(firstPoint.stamp, timescale, offset);
      const worldStamp = worldStart - 0.01;

      player.resetPlayer(worldStamp);

      const lookup = buildTrackKey(NAMESPACE_IDS.BETA, INSTANCE_IDS.BETA_SHARED, TRACK_IDS.SCALE);
      const actual = useValuesStore.getState().values.get(lookup);

      if (typeof firstPoint.value !== "number" || typeof actual !== "number") {
        throw new Error("Expected numeric values for values timescale pre-start test");
      }

      expect(worldStamp).toBeLessThan(worldStart);
      expect(actual).toBeCloseTo(firstPoint.value);
    } finally {
      player.resetPlayer(previousStamp);
    }
  });

  test("position.x stays at its initial value at the global offset frame", () => {
    const player = usePlayerStore.getState();
    const previousStamp = player.player.stamp;

    try {
      const store = createTestAnimationStore();
      const state = store.getState();
      const track = state.tracks[TRACK_IDS.POSITION_X];
      const instance =
        state.namespaces[NAMESPACE_IDS.BETA]?.animationInstances?.[INSTANCE_IDS.BETA_SHARED];

      if (!track || !instance) {
        throw new Error("Missing fixture data for position.x timescale test");
      }

      const instances = Object.values(state.namespaces).flatMap((ns) =>
        Object.values(ns.animationInstances),
      );
      const globalDuration = Math.max(
        1000,
        ...instances.map((inst) => {
          const animation = state.animations[inst.animationId];
          if (!animation) return 0;
          return (
            resolveAnimationDuration(animation, state.tracks) *
            computeWorldStamp(1, inst.settings.timescale ?? 1, inst.settings.offset ?? 0)
          );
        }),
      );

      const frameCount = Math.floor(state.framerate * (globalDuration / 1000));
      const offsetFrame = 22;
      const worldStamp = offsetFrame / frameCount;

      player.resetPlayer(worldStamp);

      const firstPoint = [...track.points].sort((a, b) => a.stamp - b.stamp)[0];
      const lookup = buildTrackKey(
        NAMESPACE_IDS.BETA,
        INSTANCE_IDS.BETA_SHARED,
        TRACK_IDS.POSITION_X,
      );
      const actual = useValuesStore.getState().values.get(lookup);

      if (typeof firstPoint.value !== "number" || typeof actual !== "number") {
        throw new Error("Expected numeric values for position.x timescale test");
      }

      expect(actual).toBeCloseTo(firstPoint.value);
    } finally {
      player.resetPlayer(previousStamp);
    }
  });
});
