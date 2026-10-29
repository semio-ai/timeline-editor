import { describe, expect, it } from "vitest";
import type { RawVector2 } from "@semio/data";
import { computePairedHandleDelta, getViewLength } from "../../functions/handle-pairing";

describe("handle pairing view-length preservation", () => {
  it("preserves the paired handle view length when using the baseline length", () => {
    const viewScaleX = 1;
    const viewScaleY = 2;
    const baselineDelta: RawVector2 = { x: -0.2, y: 0.1 };
    const draggedDelta: RawVector2 = { x: 0.15, y: 0.4 };

    const baselineLength = getViewLength(baselineDelta, viewScaleX, viewScaleY);
    const pairedDelta = computePairedHandleDelta({
      draggedDelta,
      baselineDelta,
      viewScaleX,
      viewScaleY,
      useDraggedLength: false,
    });

    expect(pairedDelta).toBeDefined();
    const pairedLength = getViewLength(pairedDelta!, viewScaleX, viewScaleY);
    expect(pairedLength).toBeCloseTo(baselineLength, 6);
  });

  it("mirrors the dragged view length when requested", () => {
    const viewScaleX = 1;
    const viewScaleY = 2;
    const baselineDelta: RawVector2 = { x: -0.2, y: 0.1 };
    const draggedDelta: RawVector2 = { x: 0.15, y: 0.4 };

    const draggedLength = getViewLength(draggedDelta, viewScaleX, viewScaleY);
    const pairedDelta = computePairedHandleDelta({
      draggedDelta,
      baselineDelta,
      viewScaleX,
      viewScaleY,
      useDraggedLength: true,
    });

    expect(pairedDelta).toBeDefined();
    const pairedLength = getViewLength(pairedDelta!, viewScaleX, viewScaleY);
    expect(pairedLength).toBeCloseTo(draggedLength, 6);
  });
});
