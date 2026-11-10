import { describe, expect, it } from "vitest";
import {
  ZoomWheelInput,
  ZoomAxis,
  classifyZoomWheel,
  fingerSpreadAxis,
  isLikelyMouseWheel,
  pinchStepFactor,
  wheelDeltaPx,
  wheelZoomFactor,
} from "../functions/wheel-input";

const PIXELS = 0;
const LINES = 1;
const PAGES = 2;

describe("wheelDeltaPx", () => {
  it("passes pixel deltas through unchanged", () => {
    expect(wheelDeltaPx({ deltaX: 0, deltaY: -100, deltaMode: PIXELS })).toEqual([0, -100]);
    expect(wheelDeltaPx({ deltaX: 2.5, deltaY: -0.75, deltaMode: PIXELS })).toEqual([2.5, -0.75]);
  });

  it("converts lines and pages to pixels", () => {
    expect(wheelDeltaPx({ deltaX: 0, deltaY: 3, deltaMode: LINES })).toEqual([0, 120]);
    expect(wheelDeltaPx({ deltaX: 1, deltaY: 0, deltaMode: PAGES })).toEqual([800, 0]);
  });
});

describe("isLikelyMouseWheel", () => {
  it("reads a line- or page-mode event as a mouse wheel", () => {
    expect(isLikelyMouseWheel({ deltaMode: LINES }, 3)).toBe(true);
    expect(isLikelyMouseWheel({ deltaMode: 2 }, 1)).toBe(true);
  });

  it("reads a large integer pixel delta as a mouse wheel notch", () => {
    expect(isLikelyMouseWheel({ deltaMode: PIXELS }, 100)).toBe(true);
    expect(isLikelyMouseWheel({ deltaMode: PIXELS }, -120)).toBe(true);
    expect(isLikelyMouseWheel({ deltaMode: PIXELS }, 50)).toBe(true);
    expect(isLikelyMouseWheel({ deltaMode: PIXELS }, -50)).toBe(true);
  });

  it("reads small or fractional pixel deltas as continuous input", () => {
    expect(isLikelyMouseWheel({ deltaMode: PIXELS }, 3)).toBe(false);
    expect(isLikelyMouseWheel({ deltaMode: PIXELS }, 49)).toBe(false);
    expect(isLikelyMouseWheel({ deltaMode: PIXELS }, 100.5)).toBe(false);
    // Chromium on macOS: a slow mouse notch, in accelerated fractional pixels.
    expect(isLikelyMouseWheel({ deltaMode: PIXELS }, 4.000244140625)).toBe(false);
  });
});

describe("classifyZoomWheel", () => {
  const ctrlKeyWheel = { deltaMode: PIXELS, ctrlKey: true };
  const cmdWheel = { deltaMode: PIXELS, ctrlKey: false };

  it("classifies a Ctrl or Cmd mouse notch as a notch", () => {
    expect(classifyZoomWheel(ctrlKeyWheel, -100, true)).toBe(ZoomWheelInput.Notch);
    expect(classifyZoomWheel(ctrlKeyWheel, -100, false)).toBe(ZoomWheelInput.Notch);
    expect(classifyZoomWheel(cmdWheel, -100, false)).toBe(ZoomWheelInput.Notch);
    expect(classifyZoomWheel({ ...ctrlKeyWheel, deltaMode: LINES }, -3, true)).toBe(
      ZoomWheelInput.Notch,
    );
  });

  it("classifies continuous ctrlKey input with Control not held as a pinch", () => {
    expect(classifyZoomWheel(ctrlKeyWheel, -2.31, false)).toBe(ZoomWheelInput.Pinch);
  });

  it("classifies continuous input with Control held, or held with Cmd, as a scroll", () => {
    // Chromium on macOS: a slow mouse notch with Control held.
    expect(classifyZoomWheel(ctrlKeyWheel, -4.000244140625, true)).toBe(ZoomWheelInput.Scroll);
    expect(classifyZoomWheel(cmdWheel, 3.5, false)).toBe(ZoomWheelInput.Scroll);
  });
});

describe("wheelZoomFactor", () => {
  it("zooms one step per notch, in for a negative delta and out for a positive one", () => {
    expect(wheelZoomFactor(-100, ZoomWheelInput.Notch, 1)).toBeCloseTo(1.1, 12);
    expect(wheelZoomFactor(100, ZoomWheelInput.Notch, 1)).toBeCloseTo(1 / 1.1, 12);
  });

  it("zooms a notch in proportion to its delta, measured in the event's own unit", () => {
    expect(wheelZoomFactor(-300, ZoomWheelInput.Notch, 1)).toBeCloseTo(1.1 ** 3, 12);
    // A 120px notch (Chromium on some Windows settings) zooms 1.2 notches' worth.
    expect(wheelZoomFactor(-120, ZoomWheelInput.Notch, 1, PIXELS)).toBeCloseTo(1.1 ** 1.2, 12);
    // Firefox line mode: 3 lines per notch, 40px per line.
    expect(wheelZoomFactor(-3 * 40, ZoomWheelInput.Notch, 1, LINES)).toBeCloseTo(1.1, 12);
    expect(wheelZoomFactor(-5 * 40, ZoomWheelInput.Notch, 1, LINES)).toBeCloseTo(
      1.1 ** (5 / 3),
      12,
    );
    // Page mode: one notch per page, 800px per page.
    expect(wheelZoomFactor(-800, ZoomWheelInput.Notch, 1, PAGES)).toBeCloseTo(1.1, 12);
  });

  it("zooms coalesced notches as far as the same notches arriving separately", () => {
    const separate = wheelZoomFactor(-120, ZoomWheelInput.Notch, 1) ** 3;
    expect(wheelZoomFactor(-360, ZoomWheelInput.Notch, 1)).toBeCloseTo(separate, 12);
  });

  it("returns a pinch's finger scale from Chromium's encoding", () => {
    for (const scale of [0.5, 0.9, 1.02, 2, 3.7]) {
      const deltaY = -100 * Math.log(scale);
      expect(wheelZoomFactor(deltaY, ZoomWheelInput.Pinch, 1)).toBeCloseTo(scale, 12);
    }
  });

  it("zooms continuous input by its total delta however it is split into events", () => {
    const whole = wheelZoomFactor(-30, ZoomWheelInput.Scroll, 1);
    const split = [-10, -12.5, -7.5].reduce(
      (product, delta) => product * wheelZoomFactor(delta, ZoomWheelInput.Scroll, 1),
      1,
    );
    expect(split).toBeCloseTo(whole, 12);
  });

  it("scales the zoom's exponent by zoomSpeed", () => {
    expect(wheelZoomFactor(-100, ZoomWheelInput.Notch, 2)).toBeCloseTo(1.1 ** 2, 12);
    const pinch = -100 * Math.log(2);
    expect(wheelZoomFactor(pinch, ZoomWheelInput.Pinch, 0.5)).toBeCloseTo(Math.SQRT2, 12);
  });

  it("does not zoom for a zero delta", () => {
    expect(wheelZoomFactor(0, ZoomWheelInput.Notch, 1)).toBe(1);
    expect(wheelZoomFactor(0, ZoomWheelInput.Pinch, 1)).toBe(1);
  });
});

describe("pinchStepFactor", () => {
  it("zooms a whole gesture by its final cumulative scale", () => {
    const cumulative = [1, 1.1, 1.3, 1.6, 2, 2];
    let previous = 1;
    let zoom = 1;
    for (const scale of cumulative) {
      zoom *= pinchStepFactor(previous, scale, 1);
      previous = scale;
    }
    expect(zoom).toBeCloseTo(2, 12);
  });

  it("does not zoom on an update that repeats the previous scale", () => {
    expect(pinchStepFactor(1.6, 1.6, 1)).toBe(1);
  });

  it("raises the step to zoomSpeed", () => {
    expect(pinchStepFactor(1, 4, 0.5)).toBeCloseTo(2, 12);
  });

  it("does not zoom for a non-positive scale", () => {
    expect(pinchStepFactor(0, 2, 1)).toBe(1);
    expect(pinchStepFactor(1, 0, 1)).toBe(1);
  });
});

describe("fingerSpreadAxis", () => {
  // use-gesture's angle is -atan2(dx, dy) in degrees.
  const angle = (dx: number, dy: number) => (-Math.atan2(dx, dy) * 180) / Math.PI;

  it("reads fingers side by side as the time axis", () => {
    expect(fingerSpreadAxis(angle(100, 0))).toBe(ZoomAxis.Time);
    expect(fingerSpreadAxis(angle(-100, 10))).toBe(ZoomAxis.Time);
    expect(fingerSpreadAxis(angle(100, 0) + 360)).toBe(ZoomAxis.Time);
  });

  it("reads one finger above the other as the value axis", () => {
    expect(fingerSpreadAxis(angle(0, 100))).toBe(ZoomAxis.Value);
    expect(fingerSpreadAxis(angle(10, -100))).toBe(ZoomAxis.Value);
  });
});
