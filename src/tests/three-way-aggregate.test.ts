import { describe, expect, it } from "vitest";
import { computeAggregate, nextToggleValue } from "../functions/three-way-aggregate";

/**
 * Three-way semantics underpin the row toggle strips and the menu items in
 * `useControlMenu`. The label shown in the menu and the action taken on click
 * must agree, which depends entirely on these two helpers.
 */

describe("computeAggregate", () => {
  it("returns false for an empty list (no entries to be on)", () => {
    expect(computeAggregate([], () => true)).toBe(false);
  });

  it("returns true when every entry is on", () => {
    expect(computeAggregate([true, true, true], (v) => v)).toBe(true);
  });

  it("returns false when every entry is off", () => {
    expect(computeAggregate([false, false], (v) => v)).toBe(false);
  });

  it('returns "partial" when entries are mixed', () => {
    expect(computeAggregate([true, false, true], (v) => v)).toBe("partial");
  });

  it("works with object entries via the getValue selector", () => {
    const rows = [{ visible: true }, { visible: false }];
    expect(computeAggregate(rows, (r) => r.visible)).toBe("partial");
  });

  it("treats missing/undefined inputs based purely on the selector's boolean output", () => {
    const rows = [{ muted: undefined }, { muted: undefined }] as { muted?: boolean }[];
    expect(computeAggregate(rows, (r) => r.muted ?? false)).toBe(false);
  });
});

describe("nextToggleValue", () => {
  it("turns everything on when starting from partial (canonical convergence)", () => {
    expect(nextToggleValue("partial")).toBe(true);
  });

  it("inverts a strict-true state", () => {
    expect(nextToggleValue(true)).toBe(false);
  });

  it("inverts a strict-false state", () => {
    expect(nextToggleValue(false)).toBe(true);
  });

  it("never returns 'partial' (toggles must always produce a strict boolean)", () => {
    (["partial", true, false] as const).forEach((current) => {
      const next = nextToggleValue(current);
      expect(next === true || next === false).toBe(true);
    });
  });
});
