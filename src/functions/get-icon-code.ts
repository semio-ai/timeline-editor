import { unitDisplay, type AnimatableValue } from "@semio/utils";

export function getIconCode(
  animatableType:
    | AnimatableValue["type"]
    | "vector2"
    | "vector3"
    | "euler"
    | "rgb"
    | "hsl"
    | "group",
  units?: string,
): string {
  if (animatableType === "number") {
    // The canonical code, so every spelling of a unit gets the same icon.
    return unitDisplay(units).code;
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
  } else if (animatableType === "group") {
    return "group";
  } else {
    return "none";
  }
}

export function getSemanticLabelForIconCode(iconCode: string): string {
  switch (iconCode) {
    case "%":
      return "Percentage";
    case "rad":
      return "Angle";
    case "deg":
      return "Angle";
    case "m":
      return "Length";
    case "mm":
      return "Length";
    case "cm":
      return "Length";
    case "km":
      return "Length";
    case "number":
      return "Number";
    case "none":
      return "No specific type";
    case "text":
      return "Text";
    case "binary":
      return "Binary value";
    case "vector2":
      return "2D Vector";
    case "vector3":
      return "3D Vector";
    case "euler":
      return "Euler Rotation";
    case "rgb":
      return "RGB Color";
    case "hsl":
      return "HSL Color";
    case "group":
      return "Group of values";
    default:
      return "Unknown type";
  }
}
