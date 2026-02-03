import { describe, expect, it } from "vitest";
import type { DeprecatedComplexAnimatableValue, RawVector3, RawValue } from "@semio/utils";
import type { Track } from "../types";
import { flattenCompositeTracks } from "../functions/flatten-tracks";

const buildVectorAnimatable = (): DeprecatedComplexAnimatableValue => ({
  id: "position",
  name: "Position",
  type: "vector3",
  default: { x: 0, y: 0, z: 0 },
  constraints: { min: [-1, -1, -1], max: [1, 1, 1], velocity: 1 },
  pub: { public: true, output: "transform.position", units: "m", color: "#fff" },
});

const buildVectorTrack = (): Track<RawValue> => ({
  id: "position",
  name: "Position",
  animatableId: "position",
  points: [
    { id: "p0", stamp: 0, value: { x: 1, y: 2, z: 3 } as RawVector3 },
    { id: "p1", stamp: 1, value: { x: 4, y: 5, z: 6 } as RawVector3 },
  ],
});

describe("flattenCompositeTracks", () => {
  it("derives deterministic component tracks for composite values", () => {
    const animatable = buildVectorAnimatable();
    const track = buildVectorTrack();

    const { tracks, derivedChildren } = flattenCompositeTracks(
      { [track.id]: track },
      { [animatable.id]: animatable },
    );

    expect(derivedChildren.position).toEqual(["position.x", "position.y", "position.z"]);
    expect(Object.keys(tracks)).toContain("position");
    expect(tracks["position.x"].points.map((point) => point.value)).toEqual([1, 4]);
    expect(tracks["position.y"].points.map((point) => point.value)).toEqual([2, 5]);
    expect(tracks["position.z"].points.map((point) => point.value)).toEqual([3, 6]);
    expect(tracks["position.x"].points[0].id).toBe("p0.x");
  });

  it("drops the composite parent when preserveOriginal is false", () => {
    const animatable = buildVectorAnimatable();
    const track = buildVectorTrack();

    const { tracks } = flattenCompositeTracks(
      { [track.id]: track },
      { [animatable.id]: animatable },
      { preserveOriginal: false },
    );

    expect(tracks.position).toBeUndefined();
    expect(tracks["position.x"]).toBeTruthy();
  });
});
