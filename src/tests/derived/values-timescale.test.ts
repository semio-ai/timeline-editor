import { describe, expect, test } from "vitest";
import { usePlayerStore, useValuesStore } from "@semio/utils";
import { computeLocalStamp, computeWorldStamp } from "../../functions";
import { clipBaker } from "../module-clip/clip-baker";
import { curveOf } from "../curves";
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
      const store = createTestAnimationStore({ trackBaker: clipBaker });
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

      const interpolator = curveOf(track, state.animations[instance.animationId], state.tracks);
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
      const store = createTestAnimationStore({ trackBaker: clipBaker });
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
      const store = createTestAnimationStore({ trackBaker: clipBaker });
      const state = store.getState();
      const track = state.tracks[TRACK_IDS.POSITION_X];
      const instance =
        state.namespaces[NAMESPACE_IDS.BETA]?.animationInstances?.[INSTANCE_IDS.BETA_SHARED];

      if (!track || !instance) {
        throw new Error("Missing fixture data for position.x timescale test");
      }

      // Pick a frame before the instance offset (250ms) so the animation hasn't started.
      // At 24fps, frame 5 = 208ms which is before the 250ms offset.
      const offsetFrame = 5;
      const worldStamp = (offsetFrame / state.framerate) * 1000;

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
