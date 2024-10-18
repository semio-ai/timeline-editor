import type { RawValue } from "@semio/utils";

export type AnimationCache = Map<string, { stamp: number; value: RawValue }[]>;
