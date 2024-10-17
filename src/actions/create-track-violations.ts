import {
  AnimatableValue,
  getLookup,
  RawEuler,
  RawValue,
  RawVector3,
  RawRGB,
  RawHSL,
  AnimatableVector3,
  AnimatableEuler,
  AnimatableColor,
  instanceOfRawVector3,
  instanceOfRawEuler,
  instanceOfRawRGB,
  instanceOfRawHSL,
  angularDistance,
} from "@semio/utils";
import { ViolationType } from "../types";
import type {
  // Keypoint,
  // Keyframe,
  Violation,
  AnimationInterpolator,
} from "../types";

export type InterpolatorCache = Map<string, Map<string, RawValue | undefined>>;
type VecConstraints = (AnimatableVector3 | AnimatableEuler)["constraints"];
type ColorConstraints = AnimatableColor["constraints"];
type RGBKey = keyof RawRGB;
type HSLKey = keyof RawHSL;

export function createTrackViolations(
  // An interpolator that takes in a time and outputs a set of values by id.
  interpolator: AnimationInterpolator,
  // The duration of the animation (in milliseconds)
  duration: number,
  // Track Id to compute violations for
  trackId: string,
  // Namespace to use
  namespace: string,
  // A lookup of animatable values by id
  animatableValue: AnimatableValue,
  // A cache to store the values of the interpolator
  cache: InterpolatorCache,
): { violations: Violation[]; cache: InterpolatorCache } {
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

  const completedViolations = new Array<Violation>();
  let openViolations: Violation[] = [];
  const defaultValue = animatableValue.default;

  for (let t = 0; t + intervalSize <= 1; t += intervalSize) {
    const stampStart = t;
    const stampEnd = t + intervalSize;
    const cacheKeyStart = stampStart.toString();
    const cacheKeyEnd = stampEnd.toString();
    const varId = getLookup(namespace, trackId);
    let interpResultStart = cache.get(cacheKeyStart);
    let interpResultEnd = cache.get(cacheKeyEnd);
    let valueStart: RawValue | undefined = interpResultStart?.get(varId);
    let valueEnd: RawValue | undefined = interpResultEnd?.get(varId);

    // Retrieve the value from the cache, run the interpolator,
    // or use the default value for the start value
    if (valueStart !== undefined) {
      continue;
    } else if (interpResultStart) {
      valueStart = defaultValue;
    } else {
      interpResultStart = interpolator(stampStart);
      valueStart = interpResultStart.get(varId) ?? defaultValue;
      cache.set(cacheKeyStart, interpResultStart);
    }

    // Retrieve the value from the cache, run the interpolator,
    // or use the default value for the end value
    if (valueEnd !== undefined) {
      continue;
    } else if (interpResultEnd) {
      valueEnd = defaultValue;
    } else {
      interpResultEnd = interpolator(stampEnd);
      valueEnd = interpResultEnd.get(varId) ?? defaultValue;
      cache.set(cacheKeyEnd, interpResultEnd);
    }

    // Define the current open violations by type
    const boundsExceededOpenViolation = openViolations.find(
      (violation) => violation.type === ViolationType.Boundary,
    );
    const velocityExceededOpenViolation = openViolations.find(
      (violation) => violation.type === ViolationType.Velocity,
    );

    // Check for violations based on the constraints specified by the AnimatableValue.

    // Check each endpoint for bounds violations
    switch (animatableValue.type) {
      case "number":
        if (
          numberHasBoundError(valueStart as number, animatableValue.constraints) ||
          numberHasBoundError(valueEnd as number, animatableValue.constraints)
        ) {
          if (boundsExceededOpenViolation === undefined) {
            openViolations.push({
              id: crypto.randomUUID(),
              stampRange: [stampStart, stampEnd],
              message: `Value exceeds valid range`,
              type: ViolationType.Boundary,
              trackId,
              namespace,
            });
          } else if (boundsExceededOpenViolation !== undefined) {
            openViolations = openViolations.map((v) => {
              if (v.id === boundsExceededOpenViolation?.id) {
                return {
                  ...v,
                  stampRange: [v.stampRange[0], stampEnd],
                };
              }
              return v;
            });
          }
        } else if (boundsExceededOpenViolation !== undefined) {
          // Close out the open violation
          completedViolations.push(boundsExceededOpenViolation);
          openViolations = openViolations.filter(
            (violation) => violation.id !== boundsExceededOpenViolation.id,
          );
        }
        break;
      case "string":
      case "boolean":
        // No bounds checking for strings or booleans
        break;
      case "vector3":
      case "euler":
        if (
          vecHasBoundError(valueStart as RawVector3 | RawEuler, animatableValue.constraints) ||
          vecHasBoundError(valueEnd as RawVector3 | RawEuler, animatableValue.constraints)
        ) {
          if (boundsExceededOpenViolation === undefined) {
            openViolations.push({
              id: crypto.randomUUID(),
              stampRange: [stampStart, stampEnd],
              message: `Value exceeds valid range`,
              type: ViolationType.Boundary,
              trackId,
              namespace,
            });
          } else if (boundsExceededOpenViolation !== undefined) {
            openViolations = openViolations.map((v) => {
              if (v.id === boundsExceededOpenViolation?.id) {
                return {
                  ...v,
                  stampRange: [v.stampRange[0], stampEnd],
                };
              }
              return v;
            });
          }
        } else if (boundsExceededOpenViolation !== undefined) {
          // Close out the open violation
          completedViolations.push(boundsExceededOpenViolation);
          openViolations = openViolations.filter(
            (violation) => violation.id !== boundsExceededOpenViolation.id,
          );
        }
        break;
      case "rgb":
      case "hsl":
        if (
          colorHasBoundError(valueStart as RawRGB | RawHSL, animatableValue.constraints) ||
          colorHasBoundError(valueEnd as RawRGB | RawHSL, animatableValue.constraints)
        ) {
          if (boundsExceededOpenViolation === undefined) {
            openViolations.push({
              id: crypto.randomUUID(),
              stampRange: [stampStart, stampEnd],
              message: `Value exceeds valid range`,
              type: ViolationType.Boundary,
              trackId,
              namespace,
            });
          } else if (boundsExceededOpenViolation !== undefined) {
            openViolations = openViolations.map((v) => {
              if (v.id === boundsExceededOpenViolation?.id) {
                return {
                  ...v,
                  stampRange: [v.stampRange[0], stampEnd],
                };
              }
              return v;
            });
          }
        } else if (boundsExceededOpenViolation !== undefined) {
          // Close out the open violation
          completedViolations.push(boundsExceededOpenViolation);
          openViolations = openViolations.filter(
            (violation) => violation.id !== boundsExceededOpenViolation.id,
          );
        }
        break;
      default:
    }

    // Check for velocity violations
    const timeDelta = (intervalSize * duration) / 1000; // Convert to seconds
    const valueDelta = genericDistance(valueStart, valueEnd);
    const velocity = Math.abs(valueDelta / timeDelta);
    if ("velocity" in animatableValue.constraints) {
      if (velocity > animatableValue.constraints.velocity!) {
        if (velocityExceededOpenViolation === undefined) {
          openViolations.push({
            id: crypto.randomUUID(),
            stampRange: [stampStart, stampEnd],
            message: `Value is changing faster than allowed by velocity limits`,
            type: ViolationType.Velocity,
            trackId,
            namespace,
          });
        } else if (velocityExceededOpenViolation !== undefined) {
          openViolations = openViolations.map((v) => {
            if (v.id === velocityExceededOpenViolation?.id) {
              return {
                ...v,
                stampRange: [v.stampRange[0], stampEnd],
              };
            }
            return v;
          });
        }
      } else if (velocityExceededOpenViolation !== undefined) {
        // Close out the open violation
        completedViolations.push(velocityExceededOpenViolation);
        openViolations = openViolations.filter(
          (violation) => violation.id !== velocityExceededOpenViolation.id,
        );
      }
    }
  }

  // Close out any open violations
  openViolations.forEach((openViolation) => {
    completedViolations.push({
      ...openViolation,
      stampRange: [openViolation.stampRange[0], 1],
    });
  });

  return { violations: completedViolations, cache };
}

function numberHasBoundError(value: number, constraints: { min?: number; max?: number }): boolean {
  if (constraints.min !== undefined && value < constraints.min) {
    return true;
  } else if (constraints.max !== undefined && value > constraints.max) {
    return true;
  }
  return false;
}

function vecHasBoundError(value: RawVector3 | RawEuler, constraints: VecConstraints): boolean {
  return ["x", "y", "z"].some((dim, i) => {
    const dimValue = value[dim as keyof RawVector3 | keyof RawEuler];
    const dimConstraints = {
      min: constraints.min?.[i] ?? undefined,
      max: constraints.max?.[i] ?? undefined,
    };
    return numberHasBoundError(dimValue as number, dimConstraints);
  });
}

function colorHasBoundError(value: RawRGB | RawHSL, constraints: ColorConstraints): boolean {
  if ("r" in Object.keys(value)) {
    return (["r", "g", "b"] as RGBKey[]).some((dim, i) => {
      const dimValue = (value as RawRGB)[dim];
      const dimConstraints = {
        min: constraints.min?.[i] ?? undefined,
        max: constraints.max?.[i] ?? undefined,
      };
      return numberHasBoundError(dimValue as number, dimConstraints);
    });
  } else if ("h" in Object.keys(value)) {
    return (["h", "s", "l"] as HSLKey[]).some((dim, i) => {
      const dimValue = (value as RawHSL)[dim];
      const dimConstraints = {
        min: constraints.min?.[i] ?? undefined,
        max: constraints.max?.[i] ?? undefined,
      };
      return numberHasBoundError(dimValue as number, dimConstraints);
    });
  }
  return false;
}

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
