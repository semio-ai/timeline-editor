import {
  StandardTransitionType,
  TransitionDirective,
  TransitionPairing,
} from "../types/data/keypoint";
import { AnimationFormatSupport, classifyAnimationFormat } from "./migrate-animation-format";

/** Animation bytes that parse but cannot be interpreted without guessing fields or units. */
export class NotAnAnimationError extends Error {
  constructor() {
    super("This animation has invalid content and cannot be opened.");
    this.name = "NotAnAnimationError";
  }
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const safeInteger = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value);
const optionalString = (value: unknown) => value === undefined || typeof value === "string";
const names = new Set<string>([
  ...Object.values(StandardTransitionType),
  ...Object.values(TransitionDirective),
]);

/** Raw structural admission shared by the codec and core; validate before unit conversion. */
export function isStoredAnimationContent(content: unknown): boolean {
  if (
    !isObject(content) ||
    classifyAnimationFormat(content.formatVersion) === AnimationFormatSupport.Unreadable
  )
    return false;
  const nanoseconds = content.formatVersion === 3;
  const transition = (value: unknown): boolean =>
    value === undefined ||
    (typeof value === "string" && names.has(value)) ||
    (isObject(value) &&
      !("x" in value) &&
      !("y" in value) &&
      safeInteger(value.dtNs) &&
      finite(value.dv));
  const transitions = (value: unknown): boolean =>
    value === undefined ||
    (isObject(value) &&
      transition(value.in) &&
      transition(value.out) &&
      (value.pairing === undefined ||
        Object.values(TransitionPairing).includes(value.pairing as TransitionPairing)));
  const point = (value: unknown): boolean =>
    isObject(value) &&
    typeof value.id === "string" &&
    (nanoseconds
      ? !("stamp" in value) &&
        safeInteger(value.timeNs) &&
        (finite(value.value) ||
          typeof value.value === "string" ||
          typeof value.value === "boolean") &&
        transitions(value.transitions)
      : !("timeNs" in value) && finite(value.stamp));
  const track = (value: unknown): boolean =>
    isObject(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.animatableId === "string" &&
    optionalString(value.inputKey) &&
    optionalString(value.groupName) &&
    (value.settings === undefined ||
      (isObject(value.settings) && (!nanoseconds || optionalString(value.settings.color)))) &&
    Array.isArray(value.points) &&
    value.points.every(point) &&
    (!nanoseconds ||
      value.points.every(
        (p) => typeof p.value === typeof (value.points as Record<string, unknown>[])[0]?.value,
      ));
  const group = (value: unknown): boolean =>
    isObject(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    Array.isArray(value.children) &&
    value.children.every((child) => typeof child === "string" || group(child));
  return (
    typeof content.id === "string" &&
    typeof content.name === "string" &&
    Array.isArray(content.tracks) &&
    content.tracks.every(track) &&
    Array.isArray(content.groups) &&
    content.groups.every(group) &&
    (content.duration === undefined || finite(content.duration)) &&
    (content.defaultViewportExtent === undefined || finite(content.defaultViewportExtent)) &&
    (!nanoseconds ||
      content.defaultViewportExtentNs === undefined ||
      safeInteger(content.defaultViewportExtentNs))
  );
}
