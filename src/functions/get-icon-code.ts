import { AnimatableValue } from "@semio/utils";
import { COMPLEX_TYPES } from "../constants";

export function getIconCode(animatable: AnimatableValue, attribute?: string): string {
  if (animatable.type === "number") {
    if (animatable.pub?.units) {
      return animatable.pub.units;
    } else {
      return "none";
    }
  } else if (animatable.type === "string") {
    return "text";
  } else if (animatable.type === "boolean") {
    return "binary";
  } else if (COMPLEX_TYPES.has(animatable.type) && attribute) {
    switch (animatable.type) {
      case "vector2":
      case "vector3":
        return "m";
      case "euler":
        return "rad";
      default:
        return "none";
    }
  } else {
    return "none";
  }
}
