import { Bezier } from "bezier-js";
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

export function cubicInterpolationGenerator<T extends RawValue>(
  a: T,
  b: T,
  props: { x1: number; x2: number },
): InterpolationFunction<T> {
  const defaultOp = () => {
    // Create a cubic bezier curve and swap when the y-value crosses the midpoint
    const bezier = new Bezier(
      { x: 0, y: 0 },
      { x: props.x1, y: 0 },
      { x: props.x2, y: 1 },
      { x: 1, y: 1 },
    );
    const intersections = bezier.lineIntersects({ p1: { x: 0, y: 0.5 }, p2: { x: 1, y: 0.5 } });
    if (intersections.length > 0) {
      // If there are intersections, we can use them to determine the switch point
      const switchPoint = intersections[0];
      return (t: number) => (t < switchPoint ? a : b) as T;
    } else {
      // If no intersections, just switch at t=0.5
      return (t: number) => (t < 0.5 ? a : b) as T;
    }
  };

  if (instanceOfRawNumber(a) && instanceOfRawNumber(b)) {
    // Create a cubic bezier curve for smooth interpolation
    const bezier = new Bezier(
      { x: 0, y: a },
      { x: props.x1, y: a },
      { x: props.x2, y: b },
      { x: 1, y: b },
    );
    return (t: number) => bezier.get(t).y as T;
  } else if (instanceOfRawString(a) && instanceOfRawString(b)) {
    return defaultOp();
  } else if (instanceOfRawBoolean(a) && instanceOfRawBoolean(b)) {
    // For booleans, we can just swap at t=0.5
    return defaultOp();
  } else if (
    (instanceOfRawVector3(a) && instanceOfRawVector3(b)) ||
    (instanceOfRawEuler(a) && instanceOfRawEuler(b))
  ) {
    return (t: number) =>
      ({
        x: cubicInterpolationGenerator(a.x, b.x, props)(t),
        y: cubicInterpolationGenerator(a.y, b.y, props)(t),
        z: cubicInterpolationGenerator(a.z, b.z, props)(t),
      }) as T;
  } else if (instanceOfRawHSL(a) && instanceOfRawHSL(b)) {
    return (t: number) =>
      ({
        h: cubicInterpolationGenerator(a.h, b.h, props)(t),
        s: cubicInterpolationGenerator(a.s, b.s, props)(t),
        l: cubicInterpolationGenerator(a.l, b.l, props)(t),
      }) as T;
  } else if (instanceOfRawRGB(a) && instanceOfRawRGB(b)) {
    return (t: number) =>
      ({
        r: cubicInterpolationGenerator(a.r, b.r, props)(t),
        g: cubicInterpolationGenerator(a.g, b.g, props)(t),
        b: cubicInterpolationGenerator(a.b, b.b, props)(t),
      }) as T;
  } else if (instanceOfRawHSL(a) && instanceOfRawRGB(b)) {
    // For now, just switch at t=0.5
    return defaultOp();
  } else {
    // DEFAULT: Switch at t=0.5
    return defaultOp();
  }
}
