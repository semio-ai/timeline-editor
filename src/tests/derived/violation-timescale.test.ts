import { describe, expect, test } from "vitest";
import { RawValue } from "@semio/utils";
import {
  buildDerivedSnapshot,
  computeTrackInterpolator,
  rawValueDiff,
  rawValueNorm,
} from "../../functions";
import { buildTrackKey } from "../../utils/track-key";
import {
  ANIMATABLE_IDS,
  ANIMATION_IDS,
  INSTANCE_IDS,
  NAMESPACE_IDS,
  TRACK_IDS,
  createTestAnimationStore,
} from "../../test-fixtures/animation-store-factory";
import { ViolationType } from "../../types";

const computeMaxVelocity = (
  interpolator: (stamp: number) => RawValue | undefined,
  durationMs: number,
  defaultValue: RawValue,
): number => {
  // Stamps are now in milliseconds; iterate over [0, durationMs]
  const steps = Math.max(Math.round((durationMs / 1000) * 100), 1);
  const intervalSize = durationMs / steps;
  const timeDelta = intervalSize / 1000;
  let valueStart = interpolator(0) ?? defaultValue;
  let maxVelocity = 0;

  for (let stampStart = 0; stampStart < durationMs; stampStart += intervalSize) {
    const stampEnd = stampStart + intervalSize;
    const valueEnd = interpolator(stampEnd) ?? defaultValue;
    const valueDelta = rawValueNorm(rawValueDiff(valueStart, valueEnd));
    const velocity = Math.abs(valueDelta / timeDelta);
    maxVelocity = Math.max(maxVelocity, velocity);
    valueStart = valueEnd;
  }

  return maxVelocity;
};

describe("violation timescale behavior", () => {
  test("timescale increases velocity violations for shared tracks", () => {
    const store = createTestAnimationStore();
    const state = store.getState();
    const animatable = state.animatables[ANIMATABLE_IDS.SCALE];
    const track = state.tracks[TRACK_IDS.SCALE];
    const animation = state.animations[ANIMATION_IDS.SHARED];
    const alphaInstance =
      state.namespaces[NAMESPACE_IDS.ALPHA].animationInstances[INSTANCE_IDS.ALPHA_SHARED];
    const betaInstance =
      state.namespaces[NAMESPACE_IDS.BETA].animationInstances[INSTANCE_IDS.BETA_SHARED];

    if (!animatable || !track || !animation || !alphaInstance || !betaInstance) {
      throw new Error("Missing fixture data for violation timescale test");
    }
    if (animatable.type !== "number") {
      throw new Error("Expected number animatable for velocity timescale test");
    }

    const alphaInterpolator = computeTrackInterpolator(track, alphaInstance);
    const betaInterpolator = computeTrackInterpolator(track, betaInstance);
    const betaTimescale = betaInstance.settings.timescale ?? 1;
    const betaScale =
      Number.isFinite(betaTimescale) && betaTimescale !== 0 ? Math.abs(betaTimescale) : 1;

    const maxAlpha = computeMaxVelocity(alphaInterpolator, animation.duration, animatable.default);
    const maxBeta = computeMaxVelocity(
      betaInterpolator,
      animation.duration / betaScale,
      animatable.default,
    );

    expect(maxBeta).toBeGreaterThan(maxAlpha);

    const tunedVelocity = (maxAlpha + maxBeta) / 2;
    const tunedAnimatables = {
      ...state.animatables,
      [ANIMATABLE_IDS.SCALE]: {
        ...animatable,
        constraints: {
          ...animatable.constraints,
          velocity: tunedVelocity,
        },
      },
    };

    const snapshot = buildDerivedSnapshot({
      tracks: state.tracks,
      namespaces: state.namespaces,
      animations: state.animations,
      animatables: tunedAnimatables,
      instancedTrackSources: state.instancedTrackSources,
      dragState: undefined,
      selectionState: state.selectionState,
      version: 1,
    });

    const alphaKey = buildTrackKey(NAMESPACE_IDS.ALPHA, INSTANCE_IDS.ALPHA_SHARED, TRACK_IDS.SCALE);
    const betaKey = buildTrackKey(NAMESPACE_IDS.BETA, INSTANCE_IDS.BETA_SHARED, TRACK_IDS.SCALE);

    const alphaVelocityViolations = (snapshot.tracks[alphaKey]?.canonical.violations ?? []).filter(
      (violation) => violation.type === ViolationType.Velocity,
    );
    const betaVelocityViolations = (snapshot.tracks[betaKey]?.canonical.violations ?? []).filter(
      (violation) => violation.type === ViolationType.Velocity,
    );

    expect(alphaVelocityViolations.length).toBe(0);
    expect(betaVelocityViolations.length).toBeGreaterThan(0);
  });
});
