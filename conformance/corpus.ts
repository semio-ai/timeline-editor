import {
  createAnimatables,
  createAnimations,
  createTracks,
} from "../src/test-fixtures/animation-data";
import { migrateAnimationData } from "../src/functions/migrate-animation-data";
import { migrateToMillisecondStamps } from "../src/functions/migrate-animation-format";
import type { StoredAnimation } from "../src/types/data/animation";
import { StandardTransitionType, TransitionDirective } from "../src/types/data/keypoint";
import type { SimpleKeypoint, SimpleRawValue, SimpleTrack } from "../src/types/data/simple-track";

function point(
  stamp: number,
  value: SimpleRawValue,
  transitions?: SimpleKeypoint["transitions"],
): SimpleKeypoint {
  return { id: `key-${stamp}`, stamp, value, transitions };
}
function animation(id: string, points: SimpleKeypoint[]): StoredAnimation {
  return {
    id,
    name: id,
    formatVersion: 2,
    groups: [],
    tracks: [{ id: "track", name: "track", animatableId: "target", points }],
  };
}

export function corpus(): StoredAnimation[] {
  const fixtures = Object.values(createAnimations(createTracks())).map((stored) =>
    migrateToMillisecondStamps(migrateAnimationData(stored, createAnimatables()).animation),
  );
  const linear = { in: StandardTransitionType.Linear, out: StandardTransitionType.Linear };
  return [
    ...fixtures,
    animation("string-track", [point(0, "idle"), point(500, "smile"), point(1500, "blink")]),
    animation("boolean-last-keypoint", [point(0, false), point(1000, true), point(2000, false)]),
    animation("explicit-handles", [
      point(0, 0, { out: { x: 400, y: 0 } }),
      point(1000, 10, { in: { x: -100, y: 0 } }),
    ]),
    animation("clamped-handles", [
      point(0, 0, { out: { x: 1800, y: 20 } }),
      point(1000, 10, { in: { x: -900, y: -15 } }),
    ]),
    animation("negative-keypoints", [
      point(-500, 0, linear),
      point(500, 1, linear),
      point(1500, 0),
    ]),
    animation("precision", [point(0, 100000), point(333.3333, 100001), point(1234.5678, 100000)]),
    ...Object.values(StandardTransitionType).map((preset) =>
      animation(`easing-${preset}`, [
        point(0, -1, { out: preset }),
        point(1000, 2, { in: preset }),
      ]),
    ),
    ...Object.values(TransitionDirective).map((directive) =>
      animation(`directive-${directive}`, [
        point(0, 0, { out: directive }),
        point(600, 1.2, { in: directive, out: directive }),
        point(1200, 0.4, { in: directive, out: directive }),
        point(4000, 0, { in: directive }),
      ]),
    ),
    animation("single-keypoint", [point(250, 42)]),
    animation("empty-track", []),
  ];
}

export function scalarTracks(stored: StoredAnimation): SimpleTrack[] {
  for (const track of stored.tracks) {
    if (track.points.some((p) => !["number", "boolean", "string"].includes(typeof p.value))) {
      throw new Error(`Composite track ${track.id} must be flattened`);
    }
  }
  return stored.tracks as SimpleTrack[];
}
