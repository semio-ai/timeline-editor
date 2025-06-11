import {
  instanceOfRawBoolean,
  instanceOfRawEuler,
  instanceOfRawHSL,
  instanceOfRawNumber,
  instanceOfRawRGB,
  instanceOfRawString,
  instanceOfRawVector3,
  RawValue,
} from "@semio/utils";
import { type InterpolationFunction } from "./interpolation";

export function linearInterpolationGenerator<T extends RawValue>(
  a: T,
  b: T,
): InterpolationFunction<T> {
  if (instanceOfRawNumber(a) && instanceOfRawNumber(b)) {
    return (t: number) => ((1 - t) * a + t * b) as T;
  } else if (instanceOfRawString(a) && instanceOfRawString(b)) {
    // For strings, we can just swap at t=0.5
    return (t: number) => (t < 0.5 ? a : b) as T;
  } else if (instanceOfRawBoolean(a) && instanceOfRawBoolean(b)) {
    // For booleans, we can just swap at t=0.5
    return (t: number) => (t < 0.5 ? a : b) as T;
  } else if (
    (instanceOfRawVector3(a) && instanceOfRawVector3(b)) ||
    (instanceOfRawEuler(a) && instanceOfRawEuler(b))
  ) {
    return (t: number) =>
      ({
        x: linearInterpolationGenerator(a.x, b.x)(t),
        y: linearInterpolationGenerator(a.y, b.y)(t),
        z: linearInterpolationGenerator(a.z, b.z)(t),
      }) as T;
  } else if (instanceOfRawHSL(a) && instanceOfRawHSL(b)) {
    return (t: number) =>
      ({
        h: linearInterpolationGenerator(a.h, b.h)(t),
        s: linearInterpolationGenerator(a.s, b.s)(t),
        l: linearInterpolationGenerator(a.l, b.l)(t),
      }) as T;
  } else if (instanceOfRawRGB(a) && instanceOfRawRGB(b)) {
    return (t: number) =>
      ({
        r: linearInterpolationGenerator(a.r, b.r)(t),
        g: linearInterpolationGenerator(a.g, b.g)(t),
        b: linearInterpolationGenerator(a.b, b.b)(t),
      }) as T;
  } else if (instanceOfRawHSL(a) && instanceOfRawRGB(b)) {
    // For now, just switch at t=0.5
    return (t: number) => (t < 0.5 ? a : b) as T;
  } else {
    // DEFAULT: Switch at t=0.5
    return (t: number) => (t < 0.5 ? a : b) as T;
  }
}
