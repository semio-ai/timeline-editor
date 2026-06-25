import { describe, expect, it } from "vitest";
import {
  inferAutoClampedHandleDeltas,
  inferAutoHandleDeltas,
} from "../functions/infer-auto-handles";

describe("inferAutoHandleDeltas", () => {
  it("returns symmetric opposing handles for a symmetric neighborhood", () => {
    const inferred = inferAutoHandleDeltas({
      prev: { stamp: 0, value: 0 },
      anchor: { stamp: 1, value: 1 },
      next: { stamp: 2, value: 0 },
    });

    expect(inferred).toBeTruthy();
    expect(inferred?.in.y).toBeCloseTo(0, 8);
    expect(inferred?.out.y).toBeCloseTo(0, 8);
    expect(inferred?.out.x).toBeCloseTo(-(inferred?.in.x ?? 0), 8);
  });

  it("applies the asymmetry clamp when neighboring spans differ significantly", () => {
    const inferred = inferAutoHandleDeltas({
      prev: { stamp: 0, value: 0 },
      anchor: { stamp: 10, value: 0 },
      next: { stamp: 11, value: 0 },
    });

    expect(inferred).toBeTruthy();
    const inLength = Math.hypot(inferred?.in.x ?? 0, inferred?.in.y ?? 0);
    const outLength = Math.hypot(inferred?.out.x ?? 0, inferred?.out.y ?? 0);
    expect(inLength / outLength).toBeCloseTo(5, 6);
  });

  it("returns undefined when neighbors are missing or direction degenerates", () => {
    expect(
      inferAutoHandleDeltas({
        anchor: { stamp: 1, value: 1 },
        next: { stamp: 2, value: 1 },
      }),
    ).toBeUndefined();

    expect(
      inferAutoHandleDeltas({
        prev: { stamp: 0, value: 0 },
        anchor: { stamp: 1, value: 0 },
        next: { stamp: 0, value: 0 },
      }),
    ).toBeUndefined();
  });

  it("uses zero-length fallback guards instead of producing NaN values", () => {
    const inferred = inferAutoHandleDeltas({
      prev: { stamp: 1, value: 1 },
      anchor: { stamp: 1, value: 1 },
      next: { stamp: 2, value: 1 },
    });

    expect(inferred).toBeTruthy();
    expect(Number.isFinite(inferred?.in.x)).toBe(true);
    expect(Number.isFinite(inferred?.in.y)).toBe(true);
    expect(Number.isFinite(inferred?.out.x)).toBe(true);
    expect(Number.isFinite(inferred?.out.y)).toBe(true);
  });
});

describe("inferAutoClampedHandleDeltas", () => {
  it("flattens both handles to horizontal at an asymmetric local maximum", () => {
    // B(5) > A(3) and B(5) > C(1), with asymmetric spans (shallow rise over a
    // wide span, steep fall over a narrow one) so the un-clamped direction
    // tilts. Auto-clamped must still be horizontal.
    const params = {
      prev: { stamp: 0, value: 3 },
      anchor: { stamp: 10, value: 5 },
      next: { stamp: 11, value: 1 },
    };
    const smooth = inferAutoHandleDeltas(params);
    const clamped = inferAutoClampedHandleDeltas(params);

    // The smooth (un-clamped) tangent is NOT horizontal here…
    expect(Math.abs(smooth?.out.y ?? 0)).toBeGreaterThan(1e-6);
    // …but the auto-clamped one is flat on both sides, x preserved.
    expect(clamped?.in.y).toBe(0);
    expect(clamped?.out.y).toBe(0);
    expect(clamped?.in.x).toBeCloseTo(smooth?.in.x ?? NaN, 8);
    expect(clamped?.out.x).toBeCloseTo(smooth?.out.x ?? NaN, 8);
  });

  it("flattens when the anchor is equal to a neighbor", () => {
    const clamped = inferAutoClampedHandleDeltas({
      prev: { stamp: 0, value: 2 },
      anchor: { stamp: 1, value: 2 }, // equal to prev
      next: { stamp: 2, value: 5 },
    });
    expect(clamped?.in.y).toBe(0);
    expect(clamped?.out.y).toBe(0);
  });

  it("leaves the tangent sloped (== smooth) when the anchor sits between its peers", () => {
    const params = {
      prev: { stamp: 0, value: 0 },
      anchor: { stamp: 1, value: 1 },
      next: { stamp: 2, value: 3 }, // strictly increasing A<B<C
    };
    const smooth = inferAutoHandleDeltas(params);
    const clamped = inferAutoClampedHandleDeltas(params);

    expect(Math.abs(clamped?.out.y ?? 0)).toBeGreaterThan(1e-6);
    expect(clamped?.in).toEqual(smooth?.in);
    expect(clamped?.out).toEqual(smooth?.out);
  });
});
