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

  it("clamps a handle that overshoots its own anchor stamp", () => {
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

  it("does not clamp when handles cross but stay within anchors", () => {
    const result = clampMonotonicCubicSegment({
      start: { stamp: 0, value: 0 },
      end: { stamp: 1, value: 1 },
      rawTransitions: {
        startOut: { x: 0.9, y: 0.4 },
        endIn: { x: 0.1, y: 0.6 },
      },
    });

    expect(result.cp1Effective).toEqual(result.cp1Raw);
    expect(result.cp2Effective).toEqual(result.cp2Raw);
    expect(result.flags.knotPrevented).toBeFalsy();
  });

  it("converts inbound handles relative to the start anchor", () => {
    const result = clampMonotonicCubicSegment({
      start: { stamp: 1, value: 2 },
      end: { stamp: 3, value: 6 },
      rawTransitions: {
        startOut: { x: 0.25, y: 0.1 },
        endIn: { x: 0.2, y: 0.6 },
      },
    });

    expect(result.cp2Raw?.x).toBeCloseTo(1 + (3 - 1) * 0.2, 5);
    expect(result.cp2Raw?.y).toBeCloseTo(2 + (6 - 2) * 0.6, 5);
  });
});
