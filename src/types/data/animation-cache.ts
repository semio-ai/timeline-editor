import type { RawValue } from "@semio/utils";

/*
@description - A cache of timestamped values for each track in the animation.
Note, the timestamps are the raw, unadjusted (with respect to namespaces) timestamps.
Whenever the animation itself is updated (e.g. when any frames, tracks, or points are changed),
the cache should be recomputed.
*/
export type AnimationCache = Record<string, { id: string; stamp: number; value: RawValue }[]>;
