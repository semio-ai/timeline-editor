import { describe, expect, it } from "vitest";
import { clampMonotonicCubicSegment } from "../functions/clamp-monotonic-cubic-segment";

describe("clampMonotonicCubicSegment", () => {
  it("returns identical raw and effective control points when already monotonic", () => {
    const result = clampMonotonicCubicSegment({
      start: { stamp: 0, value: 0 },
      end: { stamp: 1, value: 1 },
      rawTransitions: {
        startOut: { x: 0.25, y: 0 },
        endIn: { x: -0.25, y: 1 },
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
    const startOut = result.transitionsEffective.startOut;
    if (!startOut || typeof startOut === "string") {
      throw new Error("Expected a clamped vector handle");
    }
    expect(startOut.x).toBeGreaterThanOrEqual(0);
  });

  it("allows crossing handles when curve remains monotonic", () => {
    const result = clampMonotonicCubicSegment({
      start: { stamp: 0, value: 0 },
      end: { stamp: 1, value: 1 },
      rawTransitions: {
        startOut: { x: 0.9, y: 0.4 },
        endIn: { x: -0.9, y: 0.6 },
      },
    });

    expect(result.flags.knotPrevented).toBeFalsy();
    expect(result.cp1Effective).toEqual(result.cp1Raw);
    expect(result.cp2Effective).toEqual(result.cp2Raw);
  });

  it("preserves handle deltas when a control point sits on its anchor x", () => {
    const result = clampMonotonicCubicSegment({
      start: { stamp: 0, value: 1 },
      end: { stamp: 1, value: 1 },
      rawTransitions: {
        startOut: { x: 0, y: -0.2 },
        endIn: { x: -0.2, y: 0 },
      },
    });

    expect(result.cp1Raw).toEqual({ x: 0, y: 0.8 });
    expect(result.cp1Effective).toEqual(result.cp1Raw);
    expect(result.flags.cp1Clamped).toBeFalsy();
  });

  it("keeps inbound handles relative to the end anchor", () => {
    const result = clampMonotonicCubicSegment({
      start: { stamp: 1, value: 2 },
      end: { stamp: 3, value: 6 },
      rawTransitions: {
        startOut: { x: 0.25, y: 0.1 },
        endIn: { x: -0.2, y: 0.6 },
      },
    });

    expect(result.cp2Raw?.x).toBeCloseTo(3 - 0.2, 5);
    expect(result.cp2Raw?.y).toBeCloseTo(6.6, 5);
  });
});
