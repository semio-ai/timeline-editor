import type { RawVector2 } from "@semio/utils";
import { StandardTransitionType, TransitionDirective } from "../types";

const STANDARD_TRANSITION_VALUES = new Set<string>(Object.values(StandardTransitionType));
const TRANSITION_DIRECTIVE_VALUES = new Set<string>(Object.values(TransitionDirective));

export type TransitionDirectiveValue = TransitionDirective;
export type AuthoredTransitionInput =
  | RawVector2
  | StandardTransitionType
  | TransitionDirective
  | string
  | undefined;

export interface ResolvedAuthoredTransition {
  kind: "explicit" | "easing" | "directive-fallback";
  easing: StandardTransitionType;
  explicit?: RawVector2;
  directive?: TransitionDirectiveValue;
}

export function resolveAuthoredTransition(
  transition: AuthoredTransitionInput,
): ResolvedAuthoredTransition {
  if (isRawVector2(transition)) {
    return {
      kind: "explicit",
      easing: StandardTransitionType.Cubic,
      explicit: { x: transition.x, y: transition.y },
    };
  }

  if (typeof transition === "string") {
    if (isStandardTransitionTypeValue(transition)) {
      return {
        kind: "easing",
        easing: transition,
      };
    }
    if (isTransitionDirectiveValue(transition)) {
      // Directive behavior is deferred to future resolver stages.
      return {
        kind: "directive-fallback",
        easing: StandardTransitionType.Cubic,
        directive: transition,
      };
    }
  }

  return {
    kind: "easing",
    easing: StandardTransitionType.Cubic,
  };
}

function isRawVector2(value: unknown): value is RawVector2 {
  if (!value || typeof value !== "object") return false;
  const maybe = value as Partial<RawVector2>;
  return typeof maybe.x === "number" && Number.isFinite(maybe.x) && typeof maybe.y === "number";
}

function isStandardTransitionTypeValue(value: string): value is StandardTransitionType {
  return STANDARD_TRANSITION_VALUES.has(value);
}

function isTransitionDirectiveValue(value: string): value is TransitionDirectiveValue {
  return TRANSITION_DIRECTIVE_VALUES.has(value);
}
