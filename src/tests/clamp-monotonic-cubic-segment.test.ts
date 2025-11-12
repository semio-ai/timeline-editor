import { describe, expect, it } from "vitest";
import { clampMonotonicCubicSegment } from "../functions/clamp-monotonic-cubic-segment";

describe("clampMonotonicCubicSegment", () => {
  it("returns identical raw and effective control points when already monotonic", () => {
    const result = clampMonotonicCubicSegment({
      start: { stamp: 0, value: 0 },
      end: { stamp: 1, value: 1 },
      rawTransitions: {
        startOut: { x: 0.25, y: 0 },
        endIn: { x: 0.75, y: 1 },
      },
    });

    expect(result.cp1Raw).toEqual(result.cp1Effective);
    expect(result.cp2Raw).toEqual(result.cp2Effective);
    expect(result.flags).toEqual({});
  });

  it("clamps a handle that overshoots its anchor stamp", () => {
    const result = clampMonotonicCubicSegment({
      start: { stamp: 0, value: 0 },
      end: { stamp: 1, value: 1 },
      rawTransitions: {
        startOut: { x: -0.5, y: 0 },
        endIn: { x: 0.75, y: 1 },
      },
    });

    expect(result.flags.cp1Clamped).toBe(true);
    expect(result.cp1Effective?.x).toBeGreaterThanOrEqual(0);
    expect(result.transitionsEffective.startOut?.x).toBeGreaterThanOrEqual(0);
  });

  it("prevents knots when handles cross each other", () => {
    const result = clampMonotonicCubicSegment({
      start: { stamp: 0, value: 0 },
      end: { stamp: 1, value: 1 },
      rawTransitions: {
        startOut: { x: 0.9, y: 0.4 },
        endIn: { x: 0.1, y: 0.6 },
      },
    });

    expect(result.flags.knotPrevented).toBe(true);
    expect(result.cp1Effective && result.cp2Effective).toBeDefined();
    expect(
      (result.cp1Effective?.x ?? 0) <= (result.cp2Effective?.x ?? 0),
    ).toBe(true);
  });
});
