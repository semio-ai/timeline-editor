import {
  AnimatableValue,
  DeprecatedComplexAnimatableValue,
  RawEuler,
  RawValue,
  RawVector3,
  RawVector2,
  RawRGB,
  RawHSL,
  AnimatableVector3,
  AnimatableVector2,
  AnimatableEuler,
  AnimatableColor,
  AnimatableNumber,
  AnimatableString,
  AnimatableBoolean,
  instanceOfRawVector3,
  instanceOfRawVector2,
  instanceOfRawEuler,
  instanceOfRawColor,
} from "@semio/data";
import { ViolationType } from "../types";
import type { Violation, TrackInterpolator } from "../types";
import type { TrackCurve } from "./track-curve";
import { rawValueNorm, rawValueDiff } from "./raw-value-math";

type Vec3Constraints = (AnimatableVector3 | AnimatableEuler)["constraints"];
type Vec2Constraints = AnimatableVector2["constraints"];
type NumberConstraints = AnimatableNumber["constraints"];
type StringConstraints = AnimatableString["constraints"];
type BooleanConstraints = AnimatableBoolean["constraints"];
type ColorConstraints = AnimatableColor["constraints"];
type Constraints =
  | Vec3Constraints
  | Vec2Constraints
  | NumberConstraints
  | StringConstraints
  | BooleanConstraints
  | ColorConstraints;
type RGBKey = keyof RawRGB;
type HSLKey = keyof RawHSL;

/*
@description - Given a track interpolator, as well as some information about the track and
the animation, this function will create a set of violations that occur during the animation.
@param interpolator - An interpolator that takes in a time and outputs a set of values by id.
@param duration - The duration of the animation (in milliseconds)
@param trackId - Track Id to compute violations for
@param namespace - Namespace to use
@param animatableValue - The animatable value paired to the track
*/
export function computeTrackViolations(
  // An interpolator that takes in a time and outputs a set of values by id.
  interpolator: TrackInterpolator,
  // The duration of the animation (in milliseconds)
  duration: number,
  // Track Id to compute violations for
  trackId: string,
  // Namespace to use
  namespace: string,
  // Animation Instance Id
  instanceId: string,
  // The animatable value paired to the track
  animatableValue: AnimatableValue | DeprecatedComplexAnimatableValue,
): Violation[] {
  // Require that we check at an interval of 1/100th of a second (10ms).
  // Stamps are in milliseconds; iterate over [0, duration].
  const steps = Math.max(Math.round((duration / 1000) * 100), 1);
  const intervalSize = duration / steps;
  const timeDelta: number = intervalSize / 1000; // Convert interval to seconds

  const completedViolations = new Array<Violation>();
  const openViolations: Record<ViolationType, Violation | undefined> = {
    [ViolationType.Upper]: undefined,
    [ViolationType.Lower]: undefined,
    [ViolationType.Velocity]: undefined,
    [ViolationType.Rate]: undefined,
  };
  const defaultValue = animatableValue.default;

  const times = Float64Array.from({ length: steps + 1 }, (_, i) => i * intervalSize);
  const batchCurve = interpolator as Partial<TrackCurve>;
  const numbers = batchCurve.numbers?.(times);
  const values = numbers?.values ?? batchCurve.values?.(times);
  const velocities = numbers ? numbers.velocities : batchCurve.velocities?.(times);
  let valueStart: RawValue = values?.[0] ?? interpolator(0) ?? defaultValue;

  for (let i = 0; i < steps; i += 1) {
    const stampStart = times[i];
    const stampEnd = times[i + 1];
    const valueEnd: RawValue = values?.[i + 1] ?? interpolator(stampEnd) ?? defaultValue;
    for (const [violationType, violationChecker] of violationCheckerEntries) {
      const velocityLimit = (animatableValue.constraints as NumberConstraints)?.velocity;
      const violates =
        violationType === ViolationType.Velocity && velocities && velocityLimit !== undefined
          ? exceedsMax(
              Math.max(Math.abs(velocities[i]), Math.abs(velocities[i + 1])),
              velocityLimit,
            ) || violationChecker(valueStart, valueEnd, animatableValue.constraints, timeDelta)
          : violationChecker(valueStart, valueEnd, animatableValue.constraints, timeDelta);
      if (violates) {
        const openViolation = openViolations[violationType as keyof typeof violationChecker];
        if (openViolation === undefined) {
          // Open a new violation
          openViolations[violationType] = {
            id: crypto.randomUUID(),
            stampRange: { start: stampStart, end: stampEnd },
            type: violationType,
            trackId,
            namespace,
            instanceId,
          } as Violation;
        } else if (openViolation !== undefined) {
          // Update the end time of the current open violation
          (
            openViolations[violationType as keyof typeof violationChecker] as Violation
          ).stampRange.end = stampEnd;
        }
      } else if (openViolations[violationType as keyof typeof violationChecker] !== undefined) {
        // Close the violation
        completedViolations.push(openViolations[violationType as keyof typeof violationChecker]);
        openViolations[violationType] = undefined;
      }
    }
    valueStart = valueEnd;
  }

  // Close out any open violations
  Object.values(openViolations).forEach((openViolation) => {
    if (openViolation !== undefined) {
      completedViolations.push({
        ...openViolation,
        stampRange: { start: openViolation.stampRange.start, end: duration },
      });
    }
  });

  return completedViolations;
}

/**
 * Boundary tolerance for limit checks. A value held flat AT a limit is sampled
 * from the spline as `limit ± float error` (the time solve and the Bézier's
 * evaluation each round), so a strict `>`/`<` test flips on and off across frames and
 * paints scattered violations over a constant-at-limit range. Treat values
 * within this tolerance of the limit as on-limit. Scaled by magnitude so it
 * holds for large limits while staying ~1e-6 near zero. Real violations exceed
 * a limit by far more than this.
 */
const BOUNDARY_EPSILON = 1e-6;
function exceedsMax(value: number, max: number): boolean {
  return value > max + BOUNDARY_EPSILON * (1 + Math.abs(max));
}
function belowMin(value: number, min: number): boolean {
  return value < min - BOUNDARY_EPSILON * (1 + Math.abs(min));
}

function valueHasUpperBoundError(value: RawValue, constraints: Constraints): boolean {
  if (typeof value === "number" && typeof (constraints as NumberConstraints)?.max === "number") {
    return exceedsMax(value, (constraints as NumberConstraints).max ?? Infinity);
  }
  if (instanceOfRawVector2(value)) {
    return ["x", "y"].some((dim, i) => {
      const dimValue = value[dim as keyof RawVector2];
      return exceedsMax(dimValue as number, (constraints as Vec2Constraints).max?.[i] ?? Infinity);
    });
  }
  if (instanceOfRawVector3(value)) {
    return ["x", "y", "z"].some((dim, i) => {
      const dimValue = value[dim as keyof RawVector3];
      return exceedsMax(dimValue as number, (constraints as Vec3Constraints).max?.[i] ?? Infinity);
    });
  }
  if (instanceOfRawEuler(value) && (constraints as Vec3Constraints).max !== undefined) {
    return ["r", "p", "y"].some((dim, i) => {
      const dimValue = value[dim as keyof RawEuler];
      return exceedsMax(dimValue as number, (constraints as Vec3Constraints).max?.[i] ?? Infinity);
    });
  }
  if (instanceOfRawColor(value) && (constraints as ColorConstraints).max !== undefined) {
    if ("r" in Object.keys(value)) {
      return (["r", "g", "b"] as RGBKey[]).some((dim, i) => {
        const dimValue = (value as RawRGB)[dim];
        const max = (constraints as ColorConstraints).max?.[i] ?? Infinity;
        return exceedsMax(dimValue as number, max);
      });
    } else if ("h" in Object.keys(value)) {
      return (["h", "s", "l"] as HSLKey[]).some((dim, i) => {
        const dimValue = (value as RawHSL)[dim];
        const max = (constraints as ColorConstraints).max?.[i] ?? Infinity;
        return exceedsMax(dimValue as number, max);
      });
    }
  }

  return false;
}

function valueHasLowerBoundError(value: RawValue, constraints: Constraints): boolean {
  if (typeof value === "number" && typeof (constraints as NumberConstraints)?.min === "number") {
    return belowMin(value, (constraints as NumberConstraints).min ?? -Infinity);
  }
  if (instanceOfRawVector2(value)) {
    return ["x", "y"].some((dim, i) => {
      const dimValue = value[dim as keyof RawVector2];
      return belowMin(dimValue as number, (constraints as Vec2Constraints).min?.[i] ?? -Infinity);
    });
  }
  if (instanceOfRawVector3(value)) {
    return ["x", "y", "z"].some((dim, i) => {
      const dimValue = value[dim as keyof RawVector3];
      return belowMin(dimValue as number, (constraints as Vec3Constraints).min?.[i] ?? -Infinity);
    });
  }
  if (instanceOfRawEuler(value) && (constraints as Vec3Constraints).min !== undefined) {
    return ["r", "p", "y"].some((dim, i) => {
      const dimValue = value[dim as keyof RawEuler];
      return belowMin(dimValue as number, (constraints as Vec3Constraints).min?.[i] ?? -Infinity);
    });
  }
  if (instanceOfRawColor(value) && (constraints as ColorConstraints).min !== undefined) {
    if ("r" in Object.keys(value)) {
      return (["r", "g", "b"] as RGBKey[]).some((dim, i) => {
        const dimValue = (value as RawRGB)[dim];
        const min = (constraints as ColorConstraints).min?.[i] ?? -Infinity;
        return belowMin(dimValue as number, min);
      });
    } else if ("h" in Object.keys(value)) {
      return (["h", "s", "l"] as HSLKey[]).some((dim, i) => {
        const dimValue = (value as RawHSL)[dim];
        const min = (constraints as ColorConstraints).min?.[i] ?? -Infinity;
        return belowMin(dimValue as number, min);
      });
    }
  }

  return false;
}

function valueHasVelocityError(
  currentValue: RawValue,
  nextValue: RawValue,
  constraints: Constraints,
  timeDelta: number,
): boolean {
  const limit = (constraints as NumberConstraints).velocity;
  if (limit === undefined) return false;
  const valueDelta = rawValueNorm(rawValueDiff(currentValue, nextValue));
  const velocity = Math.abs(valueDelta / timeDelta);
  // Same boundary tolerance as the bound checks: motion held at the velocity
  // limit samples as limit ± float error and would otherwise flicker.
  return exceedsMax(velocity, limit);
}

type ViolationChecker = (
  currentValue: RawValue,
  nextValue: RawValue,
  constraints: Constraints,
  timeDelta: number,
) => boolean;
const violationCheckers: Record<ViolationType, ViolationChecker> = {
  [ViolationType.Upper]: (
    currentValue: RawValue,
    _nextValue: RawValue,
    constraints: Constraints,
    _timeDelta: number,
  ) => valueHasUpperBoundError(currentValue, constraints),
  [ViolationType.Lower]: (
    currentValue: RawValue,
    _nextValue: RawValue,
    constraints: Constraints,
    _timeDelta: number,
  ) => valueHasLowerBoundError(currentValue, constraints),
  [ViolationType.Velocity]: valueHasVelocityError,
  [ViolationType.Rate]: (
    _currentValue: RawValue,
    _nextValue: RawValue,
    _constraints: Constraints,
    _timeDelta: number,
  ) => false,
};
const violationCheckerEntries: [ViolationType, ViolationChecker][] = Object.entries(
  violationCheckers,
) as [ViolationType, ViolationChecker][];

/**
 * A track's violations on an instance: its curve (in local time) checked as
 * the instance plays it in world time, so the instance's timescale scales the
 * velocities, over the animation's duration in world time; reported in the
 * track's local time, as the row draws them.
 */
export function computeInstanceTrackViolations(
  curve: TrackInterpolator,
  animationDurationMs: number,
  timescale: number | undefined,
  trackId: string,
  namespace: string,
  instanceId: string,
  animatableValue: AnimatableValue | DeprecatedComplexAnimatableValue,
): Violation[] {
  const scale =
    timescale !== undefined && Number.isFinite(timescale) && timescale !== 0
      ? Math.abs(timescale)
      : 1;
  const exact = curve as Partial<TrackCurve>;
  const worldCurve = Object.assign((worldMs: number) => curve(worldMs * scale), {
    values:
      exact.values && ((times: Float64Array) => exact.values!(times.map((time) => time * scale))),
    velocities:
      exact.velocities &&
      ((times: Float64Array) =>
        exact.velocities!(times.map((time) => time * scale))?.map((velocity) => velocity * scale)),
    numbers:
      exact.numbers &&
      ((times: Float64Array) => {
        const numbers = exact.numbers!(times.map((time) => time * scale));
        return (
          numbers && {
            values: numbers.values,
            velocities: numbers.velocities.map((velocity) => velocity * scale),
          }
        );
      }),
  });
  const violations = computeTrackViolations(
    scale === 1 ? curve : worldCurve,
    animationDurationMs / scale,
    trackId,
    namespace,
    instanceId,
    animatableValue,
  );
  if (scale === 1) return violations;
  return violations.map((violation) => ({
    ...violation,
    stampRange: {
      start: violation.stampRange.start * scale,
      end: violation.stampRange.end * scale,
    },
  }));
}
