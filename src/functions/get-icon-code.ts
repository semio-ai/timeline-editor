import type { AnimatableValue } from "@semio/utils";

export function getIconCode(animatableType: AnimatableValue["type"], units?: string): string {
  if (animatableType === "number") {
    return units ?? "none";
  } else if (animatableType === "string") {
    return "text";
  } else if (animatableType === "boolean") {
    return "binary";
  } else if (
    animatableType === "vector2" ||
    animatableType === "vector3" ||
    animatableType === "euler" ||
    animatableType === "rgb" ||
    animatableType === "hsl"
  ) {
    return animatableType;
  } else {
    return "none";
  }
}
