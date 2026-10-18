import type { Animation, AuthoredTransition, TransitionInfo } from "../types";
import { StandardTransitionType, TransitionDirective } from "../types";
import type { SimpleKeypoint, SimpleRawValue, SimpleTrack } from "../types/data/simple-track";

/** A generated animation and its tracks, as the store holds them. */
export interface GeneratedAnimation {
  animation: Animation;
  tracks: Record<string, SimpleTrack>;
}

/**
 * A seeded generator of Studio animations covering what a clip can hold:
 * number, string and boolean tracks; every easing, both directives and
 * explicit handles (including ones the editor's clamps must correct);
 * keypoints out of order, sharing a stamp, or repeating a value.
 *
 */
export function randomAnimation(seed: number): GeneratedAnimation {
  const random = mulberry32(seed);
  const int = (n: number) => Math.floor(random() * n);
  const pick = <T>(items: readonly T[]): T => items[int(items.length)];

  const tracks: Record<string, SimpleTrack> = {};
  const trackCount = 1 + int(4);
  for (let t = 0; t < trackCount; t += 1) {
    const kind = pick(["number", "number", "number", "string", "boolean"] as const);
    const points: SimpleKeypoint[] = [];
    const pointCount = 1 + int(7);
    let previous: SimpleRawValue | undefined;
    for (let p = 0; p < pointCount; p += 1) {
      const stamp = 5 + 10 * int(300);
      const value = randomValue(kind, previous);
      previous = value;
      points.push({ id: `k${p}`, stamp, value, transitions: randomTransitions(kind) });
    }
    if (random() < 0.7) points.sort((a, b) => a.stamp - b.stamp);
    const id = `track-${seed}-${t}`;
    tracks[id] = { id, name: id, animatableId: `animatable-${t}`, points };
  }

  return {
    animation: {
      id: `animation-${seed}`,
      name: `animation ${seed}`,
      tracks: Object.keys(tracks),
      groups: [],
      defaultViewportExtent: random() < 0.2 ? 500 + int(4000) : undefined,
    },
    tracks,
  };

  function randomValue(
    kind: "number" | "string" | "boolean",
    previous: SimpleRawValue | undefined,
  ): SimpleRawValue {
    if (kind === "string") return pick(["idle", "smile", "blink", ""]);
    if (kind === "boolean") return random() < 0.5;
    if (typeof previous === "number" && random() < 0.25) {
      // A repeated value, or one apart by less than an f32 step of it.
      return random() < 0.5 ? previous : previous + previous * 1e-9;
    }
    return (random() - 0.5) * 100;
  }

  function randomTransitions(kind: "number" | "string" | "boolean"): TransitionInfo | undefined {
    if (random() < 0.15) return undefined;
    // Studio's interpolator cannot offset a string by an explicit handle.
    const explicit = kind !== "string";
    return { in: randomTransition(-1, explicit), out: randomTransition(1, explicit) };
  }

  function randomTransition(direction: 1 | -1, explicit: boolean): AuthoredTransition | undefined {
    const roll = random();
    if (roll < 0.15) return undefined;
    if (roll < 0.45 || !explicit) return pick(Object.values(StandardTransitionType));
    if (roll < 0.6) return pick(Object.values(TransitionDirective));
    // An explicit handle, pointing the wrong way one time in ten.
    const sign = random() < 0.1 ? -direction : direction;
    return { x: sign * random() * 400, y: (random() - 0.5) * 60 };
  }
}

/** A small, fast, seedable PRNG (mulberry32). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
