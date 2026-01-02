import { describe, expect, it } from "vitest";
import type { RawVector2 } from "@semio/utils";
import { TRACK_IDS, createTestAnimationStore } from "../../test-fixtures/animation-store-factory";
import { TransitionPairing } from "../../types";

describe("handle drag vertical freedom", () => {
  it("allows vertical movement of an explicit out handle at the top bound", () => {
    const store = createTestAnimationStore({ includeNamespaceB: false });
    const trackId = TRACK_IDS.OPACITY;
    const anchorId = "o1";
    const neighborId = "o2";

    const anchor = store.getState().tracks[trackId].points.find((p) => p.id === anchorId);
    const neighbor = store.getState().tracks[trackId].points.find((p) => p.id === neighborId);
    expect(anchor?.transitions?.pairing).toBe(TransitionPairing.Paired);
    if (!anchor || !neighbor) throw new Error("fixture points missing");

    const initialOut = anchor.transitions?.out as RawVector2 | undefined;
    expect(initialOut).toBeDefined();
    if (!initialOut) return;

    const controlPoint = {
      x: anchor.stamp + initialOut.x,
      y: (anchor.value as number) + initialOut.y,
    };

    store.getState().startHandleDrag({
      origin: { x: controlPoint.x, y: controlPoint.y },
      side: "out",
      rowId: trackId,
      trackId,
      keypointId: anchorId,
      neighborKeypointId: neighborId,
      valueScale: undefined, // no domain clamp
      controlPoint,
      startStamp: anchor.stamp,
      endStamp: neighbor.stamp,
      startValue: anchor.value as number,
      endValue: neighbor.value as number,
    });

    store.getState().updateHandleDrag({
      pointer: { x: controlPoint.x, y: controlPoint.y },
      normalizedValueDelta: 0.2,
      modifiers: { alt: false, shift: false, meta: false },
    });

    const diff = store.getState().dragState?.handleDiffs?.[anchorId]?.out as RawVector2 | undefined;
    expect(diff).toBeDefined();
    if (!diff) return;
    expect(diff.y).not.toBeCloseTo(initialOut.y ?? 0);
    expect(diff.y).toBeGreaterThan(0);
  });
});
