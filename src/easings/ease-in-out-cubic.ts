import {
  instanceOfRawEuler,
  instanceOfRawHSL,
  instanceOfRawRGB,
  instanceOfRawVector3,
  RawValue,
} from "@semio/utils";

export function easeInOutCubic(
  a: RawValue,
  b: RawValue,
): (t: number) => RawValue {
  // The first two options don't have an obvious interpolation approach, so just switch at t=0.5'
  // if the types don't match, just switch at t=0.5
  if (typeof a !== typeof b) {
    return (t: number) => (t < 0.5 ? a : b) as RawValue;
  } else if (typeof a === "boolean") {
    return (t: number) => (t < 0.5 ? a : b) as RawValue;
  } else if (typeof a === "string") {
    return (t: number) => (t < 0.5 ? a : b) as RawValue;
  } else if (typeof a === "number" && typeof b === "number") {
    return (t: number) =>
      ((t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2) * (b - a) +
        a) as RawValue;
  } else if (
    (instanceOfRawVector3(a) && instanceOfRawVector3(b)) ||
    (instanceOfRawEuler(a) && instanceOfRawEuler(b))
  ) {
    return (t: number) =>
      ({
        x: easeInOutCubic(a.x, b.x)(t),
        y: easeInOutCubic(a.y, b.y)(t),
        z: easeInOutCubic(a.z, b.z)(t),
      }) as RawValue;
  } else if (instanceOfRawHSL(a) && instanceOfRawHSL(b)) {
    return (t: number) =>
      ({
        h: easeInOutCubic(a.h, b.h)(t),
        s: easeInOutCubic(a.s, b.s)(t),
        l: easeInOutCubic(a.l, b.l)(t),
      }) as RawValue;
  } else if (instanceOfRawRGB(a) && instanceOfRawRGB(b)) {
    return (t: number) =>
      ({
        r: easeInOutCubic(a.r, b.r)(t),
        g: easeInOutCubic(a.g, b.g)(t),
        b: easeInOutCubic(a.b, b.b)(t),
      }) as RawValue;
  } else if (instanceOfRawHSL(a) && instanceOfRawRGB(b)) {
    // For now, just switch at t=0.5
    return (t: number) => (t < 0.5 ? a : b) as RawValue;
  } else {
    // DEFAULT: Switch at t=0.5
    return (t: number) => (t < 0.5 ? a : b) as RawValue;
  }
}
