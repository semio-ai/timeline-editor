import type { Track } from "./track";
import type { Keypoint } from "./keypoint";

/**
 * Simple scalar values (number/string/boolean) that tracks are allowed to store
 * once composite animatables are flattened into per-component tracks.
 */
export type SimpleRawValue = number | string | boolean;

/** Keypoint constrained to scalar values after flattening. */
export type SimpleKeypoint = Keypoint<SimpleRawValue>;
/** Track constrained to scalar values after flattening. */
export type SimpleTrack = Track<SimpleRawValue>;
