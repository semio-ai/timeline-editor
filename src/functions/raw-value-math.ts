import {
  RawValue,
  instanceOfRawVector3,
  instanceOfRawVector2,
  instanceOfRawEuler,
  instanceOfRawRGB,
  instanceOfRawHSL,
  eulerRotationBetween,
  eulerSlerp,
  rotationMatrixToAngle,
  eulerToRotationMatrix,
} from "@semio/utils";

/**
 * Computes the distance between two
 * @param point1 - The first point, can be a number, string, boolean, or an object like Vector3, Euler, RGB, HSL. Functions as the "source" point.
 * @param point2 - The second point, must be of the same type as point1. For directionality, functions as the "target" point.
 * @returns
 */
export function rawValueDiff(point1: RawValue, point2: RawValue, preserveSign?: boolean): RawValue {
  const typeofPoint1 = typeof point1;
  const typeofPoint2 = typeof point2;
  if (typeofPoint1 !== typeofPoint2) {
    // Throw if the types of the two points are not the same
    throw new Error(
      `Cannot compute distance between different types: ${typeofPoint1} and ${typeofPoint2}`,
    );
  }
  switch (typeofPoint1) {
    case "number":
      if (preserveSign) {
        return (point2 as number) - (point1 as number);
      } else {
        return Math.abs((point2 as number) - (point1 as number));
      }
    case "string":
      return (point1 as string) === (point2 as string) ? 0 : 1;
    case "boolean":
      return (point1 as boolean) === (point2 as boolean) ? 0 : 1;
    case "object":
      if (instanceOfRawVector3(point1) && instanceOfRawVector3(point2)) {
        if (preserveSign) {
          return { x: point2.x - point1.x, y: point2.y - point1.y, z: point2.z - point1.z };
        } else {
          return {
            x: Math.abs(point2.x - point1.x),
            y: Math.abs(point2.y - point1.y),
            z: Math.abs(point2.z - point1.z),
          };
        }
      } else if (instanceOfRawEuler(point1) && instanceOfRawEuler(point2)) {
        return arrayToEuler(
          eulerRotationBetween([point1.r, point1.p, point1.y], [point2.r, point2.p, point2.y]) as [
            number,
            number,
            number,
          ],
        );
      } else if (instanceOfRawVector2(point1) && instanceOfRawVector2(point2)) {
        if (preserveSign) {
          return { x: point2.x - point1.x, y: point2.y - point1.y };
        } else {
          return { x: Math.abs(point2.x - point1.x), y: Math.abs(point2.y - point1.y) };
        }
      } else if (instanceOfRawRGB(point1) && instanceOfRawRGB(point2)) {
        if (preserveSign) {
          return { r: point2.r - point1.r, g: point2.g - point1.g, b: point2.b - point1.b };
        } else {
          return {
            r: Math.abs(point2.r - point1.r),
            g: Math.abs(point2.g - point1.g),
            b: Math.abs(point2.b - point1.b),
          };
        }
      } else if (instanceOfRawHSL(point1) && instanceOfRawHSL(point2)) {
        if (preserveSign) {
          return { h: point2.h - point1.h, s: point2.s - point1.s, l: point2.l - point1.l };
        } else {
          return {
            h: Math.abs(point2.h - point1.h),
            s: Math.abs(point2.s - point1.s),
            l: Math.abs(point2.l - point1.l),
          };
        }
      } else {
        // If the object types are not recognized, throw an error
        throw new Error(`Unsupported object type for distance calculation: ${typeofPoint1}`);
      }
    default:
      // If the types are not recognized, throw an error
      throw new Error(`Unsupported type for distance calculation: ${typeofPoint1}`);
  }
}

export function rawValueAdd(a: RawValue, b: RawValue): RawValue {
  const typeofA = typeof a;
  const typeofB = typeof b;
  if (typeofA !== typeofB) {
    throw new Error(`Cannot add differing raw value types: ${typeofA} and ${typeofB}`);
  }
  switch (typeofA) {
    case "number":
      return (a as number) + (b as number);
    case "object":
      if (instanceOfRawVector3(a) && instanceOfRawVector3(b)) {
        return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
      }
      if (instanceOfRawVector2(a) && instanceOfRawVector2(b)) {
        return { x: a.x + b.x, y: a.y + b.y };
      }
      if (instanceOfRawEuler(a) && instanceOfRawEuler(b)) {
        return { r: a.r + b.r, p: a.p + b.p, y: a.y + b.y };
      }
      if (instanceOfRawRGB(a) && instanceOfRawRGB(b)) {
        return { r: a.r + b.r, g: a.g + b.g, b: a.b + b.b };
      }
      if (instanceOfRawHSL(a) && instanceOfRawHSL(b)) {
        return { h: a.h + b.h, s: a.s + b.s, l: a.l + b.l };
      }
      throw new Error(`Unsupported object type for raw value addition: ${typeofA}`);
    case "string":
      return `${a as string}${b as string}`;
    case "boolean":
      return Boolean(a) || Boolean(b);
    default:
      throw new Error(`Unsupported type for raw value addition: ${typeofA}`);
  }
}

/**
 * Multiplies a raw value by a scalar
 * @param value - The raw value to multiply (number, string, boolean, Vector3, Euler, Vector2, RGB, HSL)
 * @param scalar - The scalar number to multiply by
 * @returns The result of multiplying the raw value by the scalar
 */
export function rawValueMultiplyScalar(value: RawValue, scalar: number): RawValue {
  const typeofValue = typeof value;

  switch (typeofValue) {
    case "number":
      return (value as number) * scalar;
    case "string":
      // For strings, we'll repeat the string based on the scalar (rounded to integer)
      return (value as string).repeat(Math.max(0, Math.round(scalar)));
    case "boolean":
      // For booleans, scalar multiplication doesn't make sense, so return the original value
      return value;
    case "object":
      if (instanceOfRawVector3(value)) {
        return {
          x: value.x * scalar,
          y: value.y * scalar,
          z: value.z * scalar,
        };
      } else if (instanceOfRawEuler(value)) {
        return arrayToEuler(
          eulerSlerp([0, 0, 0], [value.r, value.p, value.y], scalar) as [number, number, number],
        );
      } else if (instanceOfRawVector2(value)) {
        return {
          x: value.x * scalar,
          y: value.y * scalar,
        };
      } else if (instanceOfRawRGB(value)) {
        return {
          r: value.r * scalar,
          g: value.g * scalar,
          b: value.b * scalar,
        };
      } else if (instanceOfRawHSL(value)) {
        return {
          h: value.h * scalar,
          s: value.s * scalar,
          l: value.l * scalar,
        };
      } else {
        // If the object type is not recognized, throw an error
        throw new Error(`Unsupported object type for scalar multiplication: ${typeofValue}`);
      }
    default:
      // If the type is not recognized, throw an error
      throw new Error(`Unsupported type for scalar multiplication: ${typeofValue}`);
  }
}

/**
 * Generates a default value (identity value) for a given rawValueType.
 * @param rawValueType - A string indicating the type of the rawValue
 * @returns a default value for the specified rawValueType.
 */
export function rawValueIdentity(rawValueType: string): RawValue {
  switch (rawValueType) {
    case "number":
      return 0;
    case "string":
      return "";
    case "boolean":
      return false;
    case "vector3":
    case "euler":
      return { x: 0, y: 0, z: 0 };
    case "vector2":
      return { x: 0, y: 0 };
    case "rgb":
      return { r: 0, g: 0, b: 0 };
    case "hsl":
      return { h: 0, s: 0, l: 0 };
    default:
      throw new Error(`Unsupported raw value type for identity: ${rawValueType}`);
  }
}

/**
 * Using a provided rawValue, this function returns the identity value for that type.
 * @param rawValue - The raw value to determine the identity for
 * @return The identity value for the type of the provided rawValue
 */
export function matchingIdentityRawValue(rawValue: RawValue) {
  const typeofValue = typeof rawValue;
  switch (typeofValue) {
    case "number":
    case "string":
    case "boolean":
      return rawValueIdentity(typeofValue);
    case "object":
      if (instanceOfRawVector3(rawValue)) {
        return rawValueIdentity("vector3");
      } else if (instanceOfRawEuler(rawValue)) {
        return rawValueIdentity("euler");
      } else if (instanceOfRawVector2(rawValue)) {
        return rawValueIdentity("vector2");
      } else if (instanceOfRawRGB(rawValue)) {
        return rawValueIdentity("rgb");
      } else if (instanceOfRawHSL(rawValue)) {
        return rawValueIdentity("hsl");
      } else {
        throw new Error(`Unsupported object type for identity: ${typeofValue}`);
      }
    default:
      throw new Error(`Unsupported type for identity: ${typeofValue}`);
  }
}

/**
 * Computes the norm of a raw value, which can be a number, string, boolean, or an object like Vector3, Euler, RGB, or HSL.
 * @param value - The raw value to compute the norm for. It can be a number, string, boolean, or an object like Vector3, Euler, RGB, or HSL.
 * @returns a number representing the norm of the raw value.
 */
export function rawValueNorm(value: RawValue): number {
  switch (typeof value) {
    case "number":
      return Math.abs(value);
    case "string":
      // For the sake of completeness, we will consider an empty string as having a norm of 0,
      // and any non-empty string as having a norm of 1.
      // We can always change this logic later if needed.
      return value === "" ? 0 : 1;
    case "boolean":
      // For boolean values, we can consider true as having a norm of 1 and false as 0.
      // We can always change this logic later if needed.
      return value ? 1 : 0;
    case "object":
      if (instanceOfRawVector3(value)) {
        return normVec([value.x, value.y, value.z]);
      } else if (instanceOfRawEuler(value)) {
        return eulerNorm([value.r, value.p, value.y]);
      } else if (instanceOfRawVector2(value)) {
        return normVec([value.x, value.y]);
      } else if (instanceOfRawRGB(value)) {
        return normVec([value.r, value.g, value.b]);
      } else if (instanceOfRawHSL(value)) {
        return normVec([value.h, value.s, value.l]);
      } else {
        // If the object types are not recognized, throw an error
        throw new Error(`Unsupported object type for norme calculation: ${typeof value}`);
      }
    default:
      // If the types are not recognized, throw an error
      throw new Error(`Unsupported type for norm calculation: ${typeof value}`);
  }
}

function normVec(vec: number[]): number {
  return Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
}

function eulerNorm(euler: [number, number, number]): number {
  return rotationMatrixToAngle(eulerToRotationMatrix(euler));
}

const arrayToEuler = (arr: [number, number, number]): { x: number; y: number; z: number } => ({
  x: arr[0],
  y: arr[1],
  z: arr[2],
});
