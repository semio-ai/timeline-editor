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

/**
 * Raw admission shared by the reader and core, before unit conversion.
 * All formats require string document id/name, arrays of tracks/groups, unique
 * track ids, string track id/name/animatableId and an array of points. Groups
 * require string id/name and recursive string-or-group children. Optional
 * inputKey/groupName are strings, settings is an object and defaultViewportExtent is finite.
 *
 * Formats 1 (also an absent version) and 2 require string point id, finite stamp,
 * a defined value of any shape (including composites and null), and no timeNs.
 * Stamps and handle x are normalized in format 1 and milliseconds in format 2.
 * Optional transitions and sides may be null or absent; present sides must be
 * named transitions or finite x/y handles without dtNs/dv. Pairing and settings
 * contents retain legacy permissiveness. Duration may be null, absent
 * or finite; format 1 defaults a null/absent duration to 5000 milliseconds.
 *
 * Format 3 requires string point id, safe-integer timeNs, no stamp, and finite
 * number/string/boolean values of one kind per track. Optional color is a string;
 * transitions is an object, pairing is a TransitionPairing, and
 * sides are named transitions or safe-integer dtNs/finite dv handles without
 * x/y. Optional duration is finite and defaultViewportExtentNs a safe integer.
 * Unknown versions are refused before tracks are inspected.
 */
export function isStoredAnimationContent(content: unknown): boolean {
  if (
    !isObject(content) ||
    classifyAnimationFormat(content.formatVersion) === AnimationFormatSupport.Unreadable
  )
    return false;
  const nanoseconds = content.formatVersion === 3;
  const transition = (value: unknown): boolean =>
    value === undefined ||
    (!nanoseconds && value === null) ||
    (typeof value === "string" && names.has(value)) ||
    (isObject(value) &&
      (nanoseconds
        ? !("x" in value) && !("y" in value) && safeInteger(value.dtNs) && finite(value.dv)
        : !("dtNs" in value) && !("dv" in value) && finite(value.x) && finite(value.y)));
  const transitions = (value: unknown): boolean =>
    value === undefined ||
    (!nanoseconds && value === null) ||
    (isObject(value) &&
      transition(value.in) &&
      transition(value.out) &&
      (!nanoseconds ||
        value.pairing === undefined ||
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
      : !("timeNs" in value) &&
        finite(value.stamp) &&
        value.value !== undefined &&
        transitions(value.transitions));
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
    new Set(content.tracks.map((item) => item.id)).size === content.tracks.length &&
    Array.isArray(content.groups) &&
    content.groups.every(group) &&
    (content.duration === undefined ||
      (!nanoseconds && content.duration === null) ||
      finite(content.duration)) &&
    (content.defaultViewportExtent === undefined || finite(content.defaultViewportExtent)) &&
    (!nanoseconds ||
      content.defaultViewportExtentNs === undefined ||
      safeInteger(content.defaultViewportExtentNs))
  );
}
