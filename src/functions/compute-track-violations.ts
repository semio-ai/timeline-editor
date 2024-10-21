import { range } from "lodash";
import {
  AnimatableValue,
  RawEuler,
  RawValue,
  RawVector3,
  RawRGB,
  RawHSL,
  AnimatableVector3,
  AnimatableEuler,
  AnimatableColor,
  AnimatableNumber,
  AnimatableString,
  AnimatableBoolean,
  instanceOfRawVector3,
  instanceOfRawEuler,
  instanceOfRawRGB,
  instanceOfRawHSL,
  angularDistance,
  instanceOfRawColor,
} from "@semio/utils";
import { ViolationType } from "../types";
import type { Violation, TrackInterpolator } from "../types";

export type InterpolatorCache = Map<string, Map<string, RawValue | undefined>>;
type VecConstraints = (AnimatableVector3 | AnimatableEuler)["constraints"];
type NumberConstraints = AnimatableNumber["constraints"];
type StringConstraints = AnimatableString["constraints"];
type BooleanConstraints = AnimatableBoolean["constraints"];
type ColorConstraints = AnimatableColor["constraints"];
type Constraints =
  | VecConstraints
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
  // The animatable value paired to the track
  animatableValue: AnimatableValue,
): Violation[] {
  // Require that we check at an interval of 1/100th of a second (10ms).
  // First, determine the interval size, normalized to to a range of 0 to 1,
  // where 0 is the start of the animation and 1 is the end.
  let intervalSize = 1 / ((duration / 1000) * 100);

  // If the interval size is greater than the duration, then we need to
  // clamp it to the duration. This results in just a single test for
  // each track.
  if (intervalSize > duration) {
    intervalSize = duration;
  }
  const timeDelta: number = (intervalSize * duration) / 1000; // Convert to seconds

  const completedViolations = new Array<Violation>();
  const openViolations: Record<ViolationType, Violation | undefined> = {
    [ViolationType.Upper]: undefined,
    [ViolationType.Lower]: undefined,
    [ViolationType.Velocity]: undefined,
    [ViolationType.Rate]: undefined,
  };
  const defaultValue = animatableValue.default;

  let valueStart: RawValue = interpolator(0) ?? defaultValue;

  range(0, 1, intervalSize).forEach((stampStart) => {
    const stampEnd = stampStart + intervalSize;
    const valueEnd: RawValue = interpolator(stampEnd) ?? defaultValue;
    violationCheckerEntries.forEach(
      ([violationType, violationChecker]: [ViolationType, ViolationChecker]) => {
        if (violationChecker(valueStart, valueEnd, animatableValue.constraints, timeDelta)) {
          if (openViolations[violationType as keyof typeof violationChecker] === undefined) {
            // Open a new violation
            openViolations[violationType] = {
              id: crypto.randomUUID(),
              stampRange: { start: stampStart, end: stampEnd },
              type: violationType,
              trackId,
              namespace,
            } as Violation;
          } else if (openViolations[violationType as keyof typeof violationChecker] !== undefined) {
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
      },
    );
    valueStart = valueEnd;
  });

  // Close out any open violations
  Object.values(openViolations).forEach((openViolation) => {
    if (openViolation !== undefined) {
      completedViolations.push({
        ...openViolation,
        stampRange: { start: openViolation.stampRange.start, end: 1 },
      });
    }
  });

  return completedViolations;
}

function valueHasUpperBoundError(value: RawValue, constraints: Constraints): boolean {
  if (typeof value === "number" && typeof (constraints as NumberConstraints)?.max === "number") {
    return value > ((constraints as NumberConstraints).max ?? Infinity);
  }
  if (
    instanceOfRawVector3(value) ||
    (instanceOfRawEuler(value) && (constraints as VecConstraints).max !== undefined)
  ) {
    return ["x", "y", "z"].some((dim, i) => {
      const dimValue = value[dim as keyof RawVector3 | keyof RawEuler];
      return (dimValue as number) > ((constraints as VecConstraints).max?.[i] ?? Infinity);
    });
  }
  if (instanceOfRawColor(value) && (constraints as ColorConstraints).max !== undefined) {
    if ("r" in Object.keys(value)) {
      return (["r", "g", "b"] as RGBKey[]).some((dim, i) => {
        const dimValue = (value as RawRGB)[dim];
        const max = (constraints as ColorConstraints).max?.[i] ?? Infinity;
        return (dimValue as number) > max;
      });
    } else if ("h" in Object.keys(value)) {
      return (["h", "s", "l"] as HSLKey[]).some((dim, i) => {
        const dimValue = (value as RawHSL)[dim];
        const max = (constraints as ColorConstraints).max?.[i] ?? Infinity;
        return (dimValue as number) > max;
      });
    }
  }

  return false;
}

function valueHasLowerBoundError(value: RawValue, constraints: Constraints): boolean {
  if (typeof value === "number" && typeof (constraints as NumberConstraints)?.min === "number") {
    return value < ((constraints as NumberConstraints).min ?? -Infinity);
  }
  if (
    instanceOfRawVector3(value) ||
    (instanceOfRawEuler(value) && (constraints as VecConstraints).min !== undefined)
  ) {
    return ["x", "y", "z"].some((dim, i) => {
      const dimValue = value[dim as keyof RawVector3 | keyof RawEuler];
      return (dimValue as number) < ((constraints as VecConstraints).min?.[i] ?? -Infinity);
    });
  }
  if (instanceOfRawColor(value) && (constraints as ColorConstraints).min !== undefined) {
    if ("r" in Object.keys(value)) {
      return (["r", "g", "b"] as RGBKey[]).some((dim, i) => {
        const dimValue = (value as RawRGB)[dim];
        const min = (constraints as ColorConstraints).min?.[i] ?? -Infinity;
        return (dimValue as number) < min;
      });
    } else if ("h" in Object.keys(value)) {
      return (["h", "s", "l"] as HSLKey[]).some((dim, i) => {
        const dimValue = (value as RawHSL)[dim];
        const min = (constraints as ColorConstraints).min?.[i] ?? -Infinity;
        return (dimValue as number) < min;
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
  const valueDelta = genericDistance(currentValue, nextValue);
  const velocity = Math.abs(valueDelta / timeDelta);
  return velocity > (constraints as NumberConstraints).velocity!;
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
  [ViolationType.Velocity]: (
    currentValue: RawValue,
    nextValue: RawValue,
    constraints: Constraints,
    timeDelta: number,
  ) => valueHasVelocityError(currentValue, nextValue, constraints, timeDelta),
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

function genericDistance(point1: RawValue, point2: RawValue): number {
  const caseKey = `${typeof point1}-${typeof point2}`;
  switch (caseKey) {
    case "number-number":
      return Math.abs((point1 as number) - (point2 as number));
    case "string-string":
      return (point1 as string) === (point2 as string) ? 0 : 1;
    case "boolean-boolean":
      return (point1 as boolean) === (point2 as boolean) ? 0 : 1;
    case "object-object":
      if (instanceOfRawVector3(point1) && instanceOfRawVector3(point2)) {
        return distance([point1.x, point1.y, point1.z], [point2.x, point2.y, point2.z]);
      } else if (instanceOfRawEuler(point1) && instanceOfRawEuler(point2)) {
        return angularDistance([point1.x, point1.y, point1.z], [point2.x, point2.y, point2.z]);
      } else if (instanceOfRawRGB(point1) && instanceOfRawRGB(point2)) {
        return distance([point1.r, point1.g, point1.b], [point2.r, point2.g, point2.b]);
      } else if (instanceOfRawHSL(point1) && instanceOfRawHSL(point2)) {
        return distance([point1.h, point1.s, point1.l], [point2.h, point2.s, point2.l]);
      } else {
        return 0;
      }
    default:
      console.error("Invalid value types", point1, point2);
      return 0;
  }
}

function distance(p1: [number, number, number], p2: [number, number, number]): number {
  return Math.sqrt((p1[0] - p2[0]) ** 2 + (p1[1] - p2[1]) ** 2 + (p1[2] - p2[2]) ** 2);
}
