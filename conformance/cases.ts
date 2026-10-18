import type { AnimationInstanceSettings, StoredAnimation } from "../src/types/data/animation";
import { computeWorldStamp } from "../src/functions/compute-instance-time";
import { corpus, scalarTracks } from "./corpus";
import { referenceCurve, type TrackSample } from "./curve";

export interface ReferenceCase {
  animation: StoredAnimation;
  instance: AnimationInstanceSettings;
  samples: { worldTimeMs: number; tracks: Record<string, TrackSample> }[];
}

export function generateCase(
  animation: StoredAnimation,
  instance: AnimationInstanceSettings,
): ReferenceCase {
  const tracks = scalarTracks(animation);
  const knots = tracks.flatMap((track) =>
    track.points.map((p) => computeWorldStamp(p.stamp, instance.timescale, instance.offset)),
  );
  const start = Math.min(instance.offset, ...knots) - 10;
  const end = Math.max(instance.offset + 1000 / instance.timescale, ...knots) + 10;
  const times = new Set(Array.from({ length: 257 }, (_, i) => start + ((end - start) * i) / 256));
  for (const knot of knots) for (const delta of [-0.001, 0, 0.001]) times.add(knot + delta);
  const curves = tracks.map((track) => ({ id: track.id, sample: referenceCurve(track, instance) }));
  return {
    animation,
    instance,
    samples: [...times]
      .sort((a, b) => a - b)
      .map((worldTimeMs) => ({
        worldTimeMs,
        tracks: Object.fromEntries(curves.map(({ id, sample }) => [id, sample(worldTimeMs)])),
      })),
  };
}

export function referenceCases(): { name: string; reference: ReferenceCase }[] {
  return corpus()
    .flatMap((animation) =>
      [0.5, 1, 2].map((timescale) => ({
        name: `${animation.id}-speed-${timescale}`,
        reference: generateCase(animation, { offset: 137, timescale, active: true }),
      })),
    )
    .concat([
      {
        name: "muted-instance",
        reference: generateCase(corpus()[0], { offset: 137, timescale: 2, active: false }),
      },
      {
        name: "muted-track",
        reference: generateCase(
          {
            ...corpus()[0],
            tracks: corpus()[0].tracks.map((track) => ({
              ...track,
              settings: { ...track.settings, muted: true },
            })),
          },
          { offset: 137, timescale: 1, active: true },
        ),
      },
    ]);
}
