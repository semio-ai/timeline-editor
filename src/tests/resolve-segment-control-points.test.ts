import { describe, expect, it } from "vitest";
import { resolveSegmentControlPoints } from "../functions/resolve-segment-control-points";
import { inferAutoHandleDeltas } from "../functions/infer-auto-handles";
import { StandardTransitionType, TransitionDirective } from "../types";

describe("resolveSegmentControlPoints", () => {
  it("derives inferred-auto-clamped raw handles and clamps them into segment bounds", () => {
    const start = { stamp: 1, value: 0 };
    const end = { stamp: 2, value: 1 };
    const neighbors = {
      startPrev: { stamp: 0, value: 2 },
      endNext: { stamp: 3, value: 0 },
    };

    const result = resolveSegmentControlPoints({
      start,
      end,
      transitions: {
        startOut: TransitionDirective.InferredAutoClamped,
        endIn: TransitionDirective.InferredAutoClamped,
      },
      neighbors,
    });

    const startInfer = inferAutoHandleDeltas({
      prev: neighbors.startPrev,
      anchor: start,
      next: end,
    });
    const endInfer = inferAutoHandleDeltas({
      prev: start,
      anchor: end,
      next: neighbors.endNext,
    });
    expect(startInfer).toBeTruthy();
    expect(endInfer).toBeTruthy();

    const startOut = result.rawTransitions.startOut;
    const endIn = result.rawTransitions.endIn;
    expect(startOut).toBeTypeOf("object");
    expect(endIn).toBeTypeOf("object");
    if (!startOut || typeof startOut !== "object") {
      throw new Error("Expected inferred explicit startOut transition");
    }
    if (!endIn || typeof endIn !== "object") {
      throw new Error("Expected inferred explicit endIn transition");
    }

    expect(result.cp1Raw).toBeTruthy();
    expect(result.cp2Raw).toBeTruthy();
    expect(result.cp1Raw?.x).toBeGreaterThanOrEqual(start.stamp);
    expect(result.cp1Raw?.x).toBeLessThanOrEqual(end.stamp);
    expect(result.cp1Raw?.y).toBeGreaterThanOrEqual(start.value);
    expect(result.cp1Raw?.y).toBeLessThanOrEqual(end.value);
    expect(result.cp2Raw?.x).toBeGreaterThanOrEqual(start.stamp);
    expect(result.cp2Raw?.x).toBeLessThanOrEqual(end.stamp);
    expect(result.cp2Raw?.y).toBeGreaterThanOrEqual(start.value);
    expect(result.cp2Raw?.y).toBeLessThanOrEqual(end.value);

    // Clamping should never amplify inferred handle magnitudes.
    expect(Math.abs(startOut.x)).toBeLessThanOrEqual(Math.abs(startInfer?.out.x ?? 0) + 1e-8);
    expect(Math.abs(startOut.y)).toBeLessThanOrEqual(Math.abs(startInfer?.out.y ?? 0) + 1e-8);
    expect(Math.abs(endIn.x)).toBeLessThanOrEqual(Math.abs(endInfer?.in.x ?? 0) + 1e-8);
    expect(Math.abs(endIn.y)).toBeLessThanOrEqual(Math.abs(endInfer?.in.y ?? 0) + 1e-8);
  });

  it("falls back directives to cubic when neighborhood context is missing", () => {
    const result = resolveSegmentControlPoints({
      start: { stamp: 0, value: 0 },
      end: { stamp: 1, value: 1 },
      transitions: {
        startOut: TransitionDirective.InferredAutoClamped,
        endIn: TransitionDirective.InferredAutoClamped,
      },
    });

    expect(result.rawTransitions.startOut).toBe(StandardTransitionType.Cubic);
    expect(result.rawTransitions.endIn).toBe(StandardTransitionType.Cubic);
  });

  it("flattens inferred-auto-clamped outgoing handles at local extrema", () => {
    const result = resolveSegmentControlPoints({
      start: { stamp: 1, value: 0 },
      end: { stamp: 2, value: 1 },
      transitions: {
        startOut: TransitionDirective.InferredAutoClamped,
        endIn: StandardTransitionType.Cubic,
      },
      neighbors: {
        startPrev: { stamp: 0, value: 2 },
      },
    });

    expect(result.cp1Raw).toBeTruthy();
    expect(result.cp1Effective).toBeTruthy();
    expect(result.cp1Raw?.y).toBeCloseTo(0, 8);
    expect(result.cp1Effective?.y).toBeCloseTo(0, 8);
    expect(result.cp1Raw?.x).toBeGreaterThan(1);
    expect(result.cp1Raw?.x).toBeLessThanOrEqual(2);
  });

  it("flattens inferred-auto-clamped incoming handles at local extrema", () => {
    const result = resolveSegmentControlPoints({
      start: { stamp: 1, value: 0 },
      end: { stamp: 2, value: 1 },
      transitions: {
        startOut: StandardTransitionType.Cubic,
        endIn: TransitionDirective.InferredAutoClamped,
      },
      neighbors: {
        endNext: { stamp: 3, value: -2 },
      },
    });

    expect(result.cp2Raw).toBeTruthy();
    expect(result.cp2Effective).toBeTruthy();
    expect(result.cp2Raw?.y).toBeCloseTo(1, 8);
    expect(result.cp2Effective?.y).toBeCloseTo(1, 8);
    expect(result.cp2Raw?.x).toBeGreaterThanOrEqual(1);
    expect(result.cp2Raw?.x).toBeLessThan(2);
  });

  it("clamps inferred-auto-clamped outgoing raw handles to the segment span", () => {
    const result = resolveSegmentControlPoints({
      start: { stamp: 1, value: -50 },
      end: { stamp: 2, value: -45 },
      transitions: {
        startOut: TransitionDirective.InferredAutoClamped,
        endIn: StandardTransitionType.Cubic,
      },
      neighbors: {
        startPrev: { stamp: 0, value: -50 },
      },
    });

    expect(result.cp1Raw).toBeTruthy();
    expect(result.cp1Raw?.x).toBeLessThanOrEqual(2);
    expect(result.cp1Raw?.x).toBeGreaterThanOrEqual(1);
    expect(result.cp1Raw?.y).toBeGreaterThanOrEqual(-50);
    expect(result.cp1Raw?.y).toBeLessThanOrEqual(-45);
    expect(result.cp1Effective?.x).toBeCloseTo(result.cp1Raw?.x ?? 0, 8);
  });

  it("clamps inferred-auto-clamped incoming raw handles to the segment span", () => {
    const result = resolveSegmentControlPoints({
      start: { stamp: 1, value: -50 },
      end: { stamp: 2, value: -45 },
      transitions: {
        startOut: StandardTransitionType.Cubic,
        endIn: TransitionDirective.InferredAutoClamped,
      },
      neighbors: {
        endNext: { stamp: 3, value: -50 },
      },
    });

    expect(result.cp2Raw).toBeTruthy();
    expect(result.cp2Raw?.x).toBeGreaterThanOrEqual(1);
    expect(result.cp2Raw?.x).toBeLessThanOrEqual(2);
    expect(result.cp2Raw?.y).toBeGreaterThanOrEqual(-50);
    expect(result.cp2Raw?.y).toBeLessThanOrEqual(-45);
    expect(result.cp2Effective?.x).toBeCloseTo(result.cp2Raw?.x ?? 0, 8);
  });
});
