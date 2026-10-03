import { describe, expect, test } from "vitest";
import type { AnimatableValue, RawValue } from "@semio/utils";
import { computeVerticalBounds } from "../functions/compute-vertical-bounds";
import type { SourceRow, Track } from "../types";

/**
 * A row whose keys all hold one value has no range of its own, so the graph infers
 * one from the unit. The range is in STORED units — the graph plots radians and
 * fractions, not the degrees and percentages a field shows.
 */
function flatRow(units: string, value: number): [number, number] {
  const animatable = {
    id: "a",
    type: "number",
    default: value,
    constraints: {},
    pub: { public: true, output: "out", units },
  } as unknown as AnimatableValue;
  const track = {
    id: "t",
    name: "Track",
    animatableId: "a",
    points: [{ id: "p0", stamp: 0, value }],
  } as unknown as Track<RawValue>;
  const source = { data: [{ trackId: "t" }] } as unknown as SourceRow;
  return computeVerticalBounds({ t: track }, { a: animatable }, [source]);
}

describe("computeVerticalBounds for a flat row", () => {
  test("gives a percentage the 0..1 its fraction is stored on, in any spelling", () => {
    expect(flatRow("%", 0.25)).toEqual([0, 1]);
    expect(flatRow("percentage", 0.25)).toEqual([0, 1]);
  });

  test("still contains a percentage stored outside 0..1", () => {
    expect(flatRow("%", 1.5)).toEqual([0, 1.5]);
  });

  test("gives an angle a full turn in radians, in any spelling", () => {
    expect(flatRow("radians", 0)).toEqual([-Math.PI, Math.PI]);
  });

  test("falls back to a window around the value for a unit with no natural range", () => {
    expect(flatRow("m", 2)).toEqual([0, 4]);
  });
});
