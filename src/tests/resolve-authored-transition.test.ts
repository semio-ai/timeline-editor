import { describe, expect, it } from "vitest";
import { resolveTransitionDelta } from "../functions/get-world-control-points";
import { resolveAuthoredTransition } from "../functions/resolve-authored-transition";
import { StandardTransitionType, TransitionDirective } from "../types";

describe("resolveAuthoredTransition", () => {
  it("returns explicit handle inputs unchanged", () => {
    const resolved = resolveAuthoredTransition({ x: 0.25, y: -0.4 });
    expect(resolved.kind).toBe("explicit");
    expect(resolved.explicit).toEqual({ x: 0.25, y: -0.4 });
  });

  it("resolves easing enums directly", () => {
    const resolved = resolveAuthoredTransition(StandardTransitionType.Quint);
    expect(resolved.kind).toBe("easing");
    expect(resolved.easing).toBe(StandardTransitionType.Quint);
  });

  it("falls back directives to cubic until directive resolvers are implemented", () => {
    const resolved = resolveAuthoredTransition(TransitionDirective.InferredAutoClamped);
    expect(resolved.kind).toBe("directive-fallback");
    expect(resolved.directive).toBe(TransitionDirective.InferredAutoClamped);
    expect(resolved.easing).toBe(StandardTransitionType.Cubic);
  });

  it("falls back unknown string transitions to cubic", () => {
    const resolved = resolveAuthoredTransition("unknown-transition");
    expect(resolved.kind).toBe("easing");
    expect(resolved.easing).toBe(StandardTransitionType.Cubic);
  });
});

describe("resolveTransitionDelta via authored transition resolver", () => {
  it("keeps directive fallback equivalent to cubic deltas", () => {
    const cubicOut = resolveTransitionDelta("out", 0, 1, 0, 10, StandardTransitionType.Cubic);
    const directiveOut = resolveTransitionDelta(
      "out",
      0,
      1,
      0,
      10,
      TransitionDirective.InferredAutoClamped,
    );
    expect(directiveOut.x).toBeCloseTo(cubicOut.x);
    expect(directiveOut.y).toBeCloseTo(cubicOut.y);

    const cubicIn = resolveTransitionDelta("in", 0, 1, 0, 10, StandardTransitionType.Cubic);
    const directiveIn = resolveTransitionDelta(
      "in",
      0,
      1,
      0,
      10,
      TransitionDirective.InferredAutoClamped,
    );
    expect(directiveIn.x).toBeCloseTo(cubicIn.x);
    expect(directiveIn.y).toBeCloseTo(cubicIn.y);
  });
});
