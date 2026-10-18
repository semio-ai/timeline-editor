import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { computeTrackInterpolator } from "../src/functions/compute-track-interpolator";
import { computeLocalStamp, computeWorldStamp } from "../src/functions/compute-instance-time";
import { createTestAnimationStore } from "../src/test-fixtures";
import type { AnimationInstance } from "../src/types/data/animation";
import type { SimpleTrack } from "../src/types/data/simple-track";
import { corpus, scalarTracks } from "./corpus";
import { referenceCurve } from "./curve";
import { referenceCases, type ReferenceCase } from "./cases";

const settings = { active: true, offset: 137, timescale: 1 };
const get = (id: string) => corpus().find((a) => a.id === id)!;
const instance = (reference: ReferenceCase): AnimationInstance => ({
  id: "instance",
  animationId: reference.animation.id,
  settings: reference.instance,
});
const directory = fileURLToPath(new URL("./reference/", import.meta.url));
const references = readdirSync(directory)
  .filter((name) => name.endsWith(".json"))
  .sort()
  .map((name) => ({
    name,
    reference: JSON.parse(readFileSync(`${directory}/${name}`, "utf8")) as ReferenceCase,
  }));

describe("animation engine reference", () => {
  it("records reproducible JSON for every case", () => {
    const generated = referenceCases().sort((a, b) => a.name.localeCompare(b.name));
    expect(references.map((r) => r.name).sort()).toEqual(
      generated.map((r) => `${r.name}.json`).sort(),
    );
    for (const { name, reference } of generated) {
      expect(readFileSync(`${directory}/${name}.json`, "utf8"), name).toBe(
        `${JSON.stringify(reference, null, 2)}\n`,
      );
    }
  });

  it("includes exactly the research harness's three fixture animations after scalar and v2 migration", () => {
    const state = createTestAnimationStore().getState();
    for (const animation of Object.values(state.animations)) {
      const stored = get(animation.id);
      expect(stored.formatVersion).toBe(2);
      expect(stored.tracks).toEqual(animation.tracks.map((id) => state.tracks[id]));
      for (const timescale of [0.5, 1, 2]) {
        expect(
          references.some(
            (r) =>
              r.reference.animation.id === animation.id &&
              r.reference.instance.timescale === timescale,
          ),
        ).toBe(true);
      }
    }
  });

  it("samples every knot and both adjacent instants, plus a dense grid and holds", () => {
    for (const { reference } of references) {
      expect(reference.samples.length).toBeGreaterThanOrEqual(257);
      const times = reference.samples.map((s) => s.worldTimeMs);
      for (const track of reference.animation.tracks)
        for (const point of track.points) {
          const knot = computeWorldStamp(
            point.stamp,
            reference.instance.timescale,
            reference.instance.offset,
          );
          for (const delta of [-0.001, 0, 0.001]) expect(times).toContain(knot + delta);
        }
    }
  });

  it("agrees with main on numeric tracks at speed 1 within 8.2e-4 of the track range", () => {
    let compared = 0;
    for (const { name, reference } of references) {
      if (reference.instance.timescale !== 1 || !reference.instance.active) continue;
      for (const track of scalarTracks(reference.animation)) {
        if (
          track.settings?.muted ||
          !track.points.length ||
          typeof track.points[0].value !== "number"
        )
          continue;
        const values = track.points.map((p) => p.value as number);
        const tolerance = (Math.max(...values) - Math.min(...values)) * 8.2e-4 + 1e-10;
        const last = Math.max(...track.points.map((p) => p.stamp));
        const interpolate = computeTrackInterpolator(track, instance(reference));
        for (const sample of reference.samples) {
          if (sample.worldTimeMs === computeWorldStamp(last, 1, reference.instance.offset))
            continue;
          const actual = interpolate(
            computeLocalStamp(sample.worldTimeMs, 1, reference.instance.offset),
          ) as number;
          expect(
            Math.abs(actual - (sample.tracks[track.id].value as number)),
            `${name}/${track.id}@${sample.worldTimeMs}`,
          ).toBeLessThanOrEqual(tolerance);
          compared += 1;
        }
      }
    }
    expect(compared).toBeGreaterThan(5000);
  });

  it("solves numeric curves to double precision instead of twelve bisections", () => {
    const track = scalarTracks(get("explicit-handles"))[0];
    // For x controls [0, 400, 900, 1000] and y [0, 0, 10, 10],
    // solving x(u)=400 gives this value (rounded from a 70-digit solve).
    expect(referenceCurve(track, settings)(537).value).toBeCloseTo(
      Number("2.434205843956003495391351958999247"),
      12,
    );
  });

  it("scales explicit handles with speed 2 while main distorts their curve", () => {
    const track = scalarTracks(get("explicit-handles"))[0];
    const fast = { ...settings, timescale: 2 };
    const expected = referenceCurve(track, settings)(537).value as number;
    const actual = referenceCurve(track, fast)(337).value as number;
    expect(actual).toBeCloseTo(expected, 12);
    const main = computeTrackInterpolator(track, { id: "i", animationId: "a", settings: fast });
    expect(Math.abs((main(400) as number) - actual)).toBeGreaterThan(0.5);
  });

  it("plays strings as left steps, with the final value at the final instant, while main throws", () => {
    const track = scalarTracks(get("string-track"))[0];
    const curve = referenceCurve(track, settings);
    expect(curve(136).value).toBe("idle");
    expect(curve(637).value).toBe("idle");
    expect(curve(637.001).value).toBe("smile");
    expect(curve(1637)).toEqual({ value: "blink", velocity: null });
    expect(() =>
      computeTrackInterpolator(track, { id: "i", animationId: "a", settings }),
    ).toThrow();
  });

  it("plays the last boolean at its instant while main holds its left value", () => {
    const track = scalarTracks(get("boolean-last-keypoint"))[0];
    const curve = referenceCurve(track, settings);
    expect(curve(2136.999)).toEqual({ value: true, velocity: null });
    expect(curve(2137)).toEqual({ value: false, velocity: null });
    const main = computeTrackInterpolator(track, { id: "i", animationId: "a", settings });
    expect(main(2000)).toBe(true);
  });

  it("evaluates negative local time and uses offset without clamping to zero", () => {
    const track = scalarTracks(get("negative-keypoints"))[0];
    expect(referenceCurve(track, settings)(-113).value).toBeCloseTo(0.25, 12);
  });

  it("returns world velocities in units per second and scales them with speed", () => {
    const track: SimpleTrack = {
      id: "linear",
      name: "Linear",
      animatableId: "target",
      points: get("negative-keypoints").tracks[0].points.slice(0, 2) as SimpleTrack["points"],
    };
    for (const timescale of [0.5, 1, 2]) {
      const curve = referenceCurve(track, { ...settings, timescale });
      const time = computeWorldStamp(100, timescale, settings.offset);
      expect(curve(time).velocity).toBeCloseTo(timescale, 12);
      expect(curve(time).velocity).toBeCloseTo(
        ((curve(time + 0.001).value as number) - (curve(time - 0.001).value as number)) / 0.000002,
        7,
      );
      expect(curve(-2000).velocity).toBe(0);
      expect(curve(5000).velocity).toBe(0);
    }
  });

  it("matches analytic derivatives to finite differences throughout curved segments", () => {
    for (const animation of corpus())
      for (const track of scalarTracks(animation)) {
        if (!track.points.length || typeof track.points[0].value !== "number") continue;
        const curve = referenceCurve(track, { ...settings, timescale: 2 });
        const times = track.points
          .map((p) => computeWorldStamp(p.stamp, 2, settings.offset))
          .sort((a, b) => a - b);
        for (let i = 1; i < times.length; i += 1) {
          const t = times[i - 1] + (times[i] - times[i - 1]) * 0.37;
          const difference =
            ((curve(t + 0.0001).value as number) - (curve(t - 0.0001).value as number)) / 0.0000002;
          expect(curve(t).velocity).toBeCloseTo(difference, 3);
        }
      }
  });

  it("represents muted instances, muted tracks and empty tracks as no contribution", () => {
    for (const name of ["muted-instance.json", "muted-track.json", "empty-track-speed-1.json"]) {
      const reference = references.find((r) => r.name === name)!.reference;
      for (const sample of reference.samples)
        for (const output of Object.values(sample.tracks)) {
          expect(output).toEqual({ value: null, velocity: null });
        }
    }
  });
});
