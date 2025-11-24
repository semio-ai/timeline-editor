import type { RawValue } from "@semio/utils";
import type { Keypoint } from "../types";

export type TransitionValue = NonNullable<Keypoint<RawValue>["transitions"]>["in"];

export const cloneTransitionValue = (value?: TransitionValue): TransitionValue => {
  if (!value) {
    return value as TransitionValue;
  }
  return typeof value === "object" ? { ...value } : value;
};

export const cloneTransitions = (
  transitions?: Keypoint<RawValue>["transitions"],
): Keypoint<RawValue>["transitions"] => {
  if (!transitions) {
    return undefined;
  }

  return {
    in: cloneTransitionValue(transitions.in),
    out: cloneTransitionValue(transitions.out),
  };
};
