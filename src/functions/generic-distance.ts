import {
  RawValue,
  instanceOfRawVector3,
  instanceOfRawVector2,
  instanceOfRawEuler,
  instanceOfRawRGB,
  instanceOfRawHSL,
  angularDistance,
} from "@semio/utils";

export function genericDistance(point1: RawValue, point2: RawValue): number {
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
        return distance3d([point1.x, point1.y, point1.z], [point2.x, point2.y, point2.z]);
      } else if (instanceOfRawEuler(point1) && instanceOfRawEuler(point2)) {
        return angularDistance([point1.x, point1.y, point1.z], [point2.x, point2.y, point2.z]);
      } else if (instanceOfRawVector2(point1) && instanceOfRawVector2(point2)) {
        return distance2d([point1.x, point1.y], [point2.x, point2.x]);
      } else if (instanceOfRawRGB(point1) && instanceOfRawRGB(point2)) {
        return distance3d([point1.r, point1.g, point1.b], [point2.r, point2.g, point2.b]);
      } else if (instanceOfRawHSL(point1) && instanceOfRawHSL(point2)) {
        return distance3d([point1.h, point1.s, point1.l], [point2.h, point2.s, point2.l]);
      } else {
        return 0;
      }
    default:
      console.error("Invalid value types", point1, point2);
      return 0;
  }
}

function distance3d(p1: [number, number, number], p2: [number, number, number]): number {
  return Math.sqrt((p1[0] - p2[0]) ** 2 + (p1[1] - p2[1]) ** 2 + (p1[2] - p2[2]) ** 2);
}

function distance2d(p1: [number, number], p2: [number, number]): number {
  return Math.sqrt((p1[0] - p2[0]) ** 2 + (p1[1] - p2[1]) ** 2);
}
