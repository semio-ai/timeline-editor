import { describe, expect, it } from "vitest";
import { inferAutoHandleDeltas } from "../functions/infer-auto-handles";

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
