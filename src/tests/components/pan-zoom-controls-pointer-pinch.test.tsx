// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import { setViewport, splineCameraYMotion } from "../../viewport-state";
import { TrackRender } from "../../types";
import {
  HEIGHT,
  gapsTo,
  mount,
  pointerPinch,
  snapshot,
  zoomSince,
} from "./pan-zoom-controls-harness";

// Browsers with pointer events (Chromium, Safari) make use-gesture read a pinch from
// pointer events, which carry no `touches`. use-gesture picks its pinch device when it
// loads, so jsdom gets pointer support before the imports, which `vi.hoisted` precedes.
vi.hoisted(() => {
  (window as unknown as { onpointerdown: null }).onpointerdown = null;
  const proto = Element.prototype as unknown as Record<string, () => void>;
  proto.setPointerCapture = () => {};
  proto.releasePointerCapture = () => {};
});

const host = vi.hoisted(() => ({ three: undefined as unknown }));
vi.mock("@react-three/fiber", () => ({ useThree: () => host.three }));

beforeEach(() => {
  setViewport(1000, 3000);
  splineCameraYMotion.set({ top: HEIGHT / 2, bottom: -HEIGHT / 2 });
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

describe("PanZoomControls pointer pinch", () => {
  it("zooms the axis the fingers are spread along in Spline mode", () => {
    const canvas = mount(host, TrackRender.Spline);
    const beforeHorizontal = snapshot();
    pointerPinch(canvas, gapsTo(2), "horizontal");
    const horizontal = zoomSince(beforeHorizontal);
    expect(horizontal.time).toBeCloseTo(2, 2);
    expect(horizontal.value).toBeCloseTo(1, 6);

    const beforeVertical = snapshot();
    pointerPinch(canvas, gapsTo(2), "vertical");
    const vertical = zoomSince(beforeVertical);
    expect(vertical.value).toBeCloseTo(2, 2);
    expect(vertical.time).toBeCloseTo(1, 6);
  });

  it("starts each pinch from the zoom the last one left", () => {
    const canvas = mount(host, TrackRender.Key);
    const before = snapshot();
    pointerPinch(canvas, gapsTo(2));
    const one = zoomSince(before).time;
    pointerPinch(canvas, gapsTo(2));
    expect(one).toBeCloseTo(2, 2);
    expect(zoomSince(before).time).toBeCloseTo(one * one, 6);
  });
});
