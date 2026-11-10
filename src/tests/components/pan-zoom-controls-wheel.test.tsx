// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup } from "@testing-library/react";
import type { ComponentProps } from "react";
import { useTooltipStore } from "@semio/ui";
import type { PanZoomControls } from "../../components/controls/pan-zoom-controls";
import {
  setTrackScroll,
  setViewport,
  splineCameraYMotion,
  trackScrollMotion,
} from "../../viewport-state";
import { TrackRender } from "../../types";
import {
  HEIGHT,
  controlKey,
  gapsTo,
  mount as mountPanZoom,
  pinchDeltas,
  snapshot,
  touch,
  touchPinch,
  wheel,
  wheelStream,
  zoomSince,
} from "./pan-zoom-controls-harness";

// `vi.mock` is hoisted above the imports; see the harness for what `host` holds.
const host = vi.hoisted(() => ({ three: undefined as unknown }));
vi.mock("@react-three/fiber", () => ({ useThree: () => host.three }));

function mount(
  trackRender: TrackRender,
  props: Partial<ComponentProps<typeof PanZoomControls>> = {},
): HTMLCanvasElement {
  return mountPanZoom(host, trackRender, props);
}

beforeEach(() => {
  vi.useFakeTimers();
  setViewport(1000, 3000);
  splineCameraYMotion.set({ top: HEIGHT / 2, bottom: -HEIGHT / 2 });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("PanZoomControls wheel zoom, Key mode", () => {
  it("zooms time by one step for a Ctrl+wheel notch", () => {
    const canvas = mount(TrackRender.Key);
    const before = snapshot();
    wheelStream(canvas, [-100], { ctrlKey: true });
    expect(zoomSince(before).time).toBeCloseTo(1.1, 6);
  });

  it("zooms time by the same step for a Cmd+wheel notch", () => {
    const canvas = mount(TrackRender.Key);
    const before = snapshot();
    wheelStream(canvas, [-100], { metaKey: true });
    expect(zoomSince(before).time).toBeCloseTo(1.1, 6);
  });

  it("returns to the starting width after a notch in and a notch out", () => {
    const canvas = mount(TrackRender.Key);
    const before = snapshot();
    wheelStream(canvas, [-100, 100], { ctrlKey: true });
    expect(zoomSince(before).time).toBeCloseTo(1, 6);
  });

  it("zooms one step per notch when the browser coalesces notches into one event", () => {
    const canvas = mount(TrackRender.Key);
    const before = snapshot();
    wheelStream(canvas, [-300], { ctrlKey: true });
    expect(zoomSince(before).time).toBeCloseTo(1.1 ** 3, 6);
  });

  it("zooms 120px notches the same whether they arrive separately or coalesced", () => {
    const canvas = mount(TrackRender.Key);
    const beforeSeparate = snapshot();
    wheelStream(canvas, [-120, -120, -120], { ctrlKey: true });
    const separate = zoomSince(beforeSeparate).time;
    const beforeCoalesced = snapshot();
    wheelStream(canvas, [-360], { ctrlKey: true });
    expect(zoomSince(beforeCoalesced).time).toBeCloseTo(separate, 6);
    expect(separate).toBeCloseTo(1.1 ** 3.6, 6);
  });

  it("zooms one step for a Firefox line-mode Ctrl+wheel notch", () => {
    const canvas = mount(TrackRender.Key);
    const before = snapshot();
    wheelStream(canvas, [-3], { ctrlKey: true, deltaMode: 1 });
    expect(zoomSince(before).time).toBeCloseTo(1.1, 6);
  });

  it("zooms one step for a page-mode Ctrl+wheel event", () => {
    const canvas = mount(TrackRender.Key);
    const before = snapshot();
    wheelStream(canvas, [-1], { ctrlKey: true, deltaMode: 2 });
    expect(zoomSince(before).time).toBeCloseTo(1.1, 6);
  });

  it("zooms by the horizontal delta when it dominates", () => {
    const canvas = mount(TrackRender.Key);
    const before = snapshot();
    wheel(canvas, { deltaX: -100, deltaY: 0, metaKey: true });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(zoomSince(before).time).toBeCloseTo(1.1, 6);
  });

  it("zooms time by the scale the fingers made for a trackpad pinch", () => {
    const canvas = mount(TrackRender.Key);
    const before = snapshot();
    wheelStream(canvas, pinchDeltas(2, 20), { ctrlKey: true });
    expect(zoomSince(before).time).toBeCloseTo(2, 6);
  });

  it("zooms a slow pinch whose events each carry under half a pixel", () => {
    const canvas = mount(TrackRender.Key);
    const before = snapshot();
    const deltas = pinchDeltas(1.05, 20);
    expect(Math.abs(deltas[0])).toBeLessThan(0.5);
    wheelStream(canvas, deltas, { ctrlKey: true });
    expect(zoomSince(before).time).toBeCloseTo(1.05, 6);
  });

  it("zooms a continuous Cmd+scroll by its total delta, not by how many events carried it", () => {
    const coarse = mount(TrackRender.Key);
    const before = snapshot();
    wheelStream(coarse, [-10, -10, -10], { metaKey: true });
    const fromThree = zoomSince(before).time;
    cleanup();

    setViewport(1000, 3000);
    const fine = mount(TrackRender.Key);
    wheelStream(
      fine,
      Array.from({ length: 12 }, () => -2.5),
      { metaKey: true },
    );
    expect(zoomSince(before).time).toBeCloseTo(fromThree, 6);
    expect(fromThree).toBeGreaterThan(1);
  });

  it("does not zoom for a plain wheel", () => {
    const canvas = mount(TrackRender.Key);
    const before = snapshot();
    wheelStream(canvas, [-100], {});
    expect(zoomSince(before).time).toBeCloseTo(1, 6);
  });
});

describe("PanZoomControls while an interactive overlay is open", () => {
  it("neither zooms nor lets the browser zoom the page for a ctrlKey wheel", () => {
    const hasInteractiveOverlay = useTooltipStore.getState().hasInteractiveOverlay;
    useTooltipStore.setState({ hasInteractiveOverlay: () => true });
    try {
      const canvas = mount(TrackRender.Key);
      const before = snapshot();
      const notch = wheel(canvas, { deltaY: -100, ctrlKey: true });
      const pinch = wheel(canvas, { deltaY: -2.31, ctrlKey: true });
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(notch.defaultPrevented).toBe(true);
      expect(pinch.defaultPrevented).toBe(true);
      expect(zoomSince(before).time).toBeCloseTo(1, 6);
    } finally {
      useTooltipStore.setState({ hasInteractiveOverlay });
    }
  });
});

// use-gesture accumulates every wheel delta a canvas has seen and hands the handler
// the difference of two running totals. Once a fractional (trackpad) delta is in the
// total, consecutive notches of one spin come back as e.g. -99.99999999999999, which
// no longer reads as a notch. A notch has to be read from the event itself.
describe("PanZoomControls mouse notches after trackpad input", () => {
  const SPIN = [-100, -100, -100, -100];

  it("zooms one step per notch for a Ctrl+wheel spin", () => {
    const canvas = mount(TrackRender.Key);
    wheelStream(canvas, [3.3], {});
    const before = snapshot();
    wheelStream(canvas, SPIN, { ctrlKey: true });
    expect(zoomSince(before).time).toBeCloseTo(1.1 ** SPIN.length, 6);
  });

  it("damps every notch's vertical scroll by panSpeed", () => {
    const canvas = mount(TrackRender.Key);
    setTrackScroll(0);
    wheelStream(canvas, [3.3], {});
    const before = trackScrollMotion.get();
    wheelStream(
      canvas,
      SPIN.map((d) => -d),
      {},
    );
    expect(trackScrollMotion.get() - before).toBeCloseTo(SPIN.length * 100 * 0.25, 6);
  });
});

describe("PanZoomControls wheel zoom, Spline mode", () => {
  it("zooms only the value axis, by one step, for a Ctrl+wheel notch", () => {
    const canvas = mount(TrackRender.Spline);
    const before = snapshot();
    wheelStream(canvas, [-100], { ctrlKey: true });
    const zoom = zoomSince(before);
    expect(zoom.value).toBeCloseTo(1.1, 6);
    expect(zoom.time).toBeCloseTo(1, 6);
  });

  it("zooms only time, by one step, for a Ctrl+Shift+wheel notch", () => {
    const canvas = mount(TrackRender.Spline);
    const before = snapshot();
    wheelStream(canvas, [-100], { ctrlKey: true, shiftKey: true });
    const zoom = zoomSince(before);
    expect(zoom.time).toBeCloseTo(1.1, 6);
    expect(zoom.value).toBeCloseTo(1, 6);
  });

  // Chromium on macOS reports a mouse wheel as continuous, fractional pixels, so a
  // Mac Ctrl+wheel looks like a pinch except for the Control key actually being down.
  const macNotch = -4.000244140625;

  it("zooms only the value axis for continuous input with Control held, and pinches once it is released", () => {
    const canvas = mount(TrackRender.Spline);
    const held = snapshot();
    controlKey("keydown");
    wheelStream(canvas, Array(5).fill(macNotch), { ctrlKey: true });
    const heldZoom = zoomSince(held);
    expect(heldZoom.value).toBeCloseTo(Math.exp((-5 * macNotch) / 100), 6);
    expect(heldZoom.time).toBeCloseTo(1, 6);

    controlKey("keyup");
    const released = snapshot();
    wheelStream(canvas, Array(5).fill(macNotch), { ctrlKey: true });
    expect(zoomSince(released).time).toBeCloseTo(Math.exp((-5 * macNotch) / 100), 6);
  });

  it("zooms only time for continuous input with Control and Shift held", () => {
    const canvas = mount(TrackRender.Spline);
    const before = snapshot();
    controlKey("keydown");
    wheelStream(canvas, Array(5).fill(macNotch), { ctrlKey: true, shiftKey: true });
    controlKey("keyup");
    const zoom = zoomSince(before);
    expect(zoom.time).toBeCloseTo(Math.exp((-5 * macNotch) / 100), 6);
    expect(zoom.value).toBeCloseTo(1, 6);
  });

  it("reads Control as held from pointer movement, and as released when the window loses focus", () => {
    const canvas = mount(TrackRender.Spline);
    // Control pressed while another window had focus: no keydown, but the pointer
    // events that follow report it.
    act(() => {
      document.dispatchEvent(new MouseEvent("pointermove", { ctrlKey: true, bubbles: true }));
    });
    const held = snapshot();
    wheelStream(canvas, Array(5).fill(macNotch), { ctrlKey: true });
    expect(zoomSince(held).time).toBeCloseTo(1, 6);

    act(() => {
      window.dispatchEvent(new Event("blur"));
    });
    const released = snapshot();
    wheelStream(canvas, Array(5).fill(macNotch), { ctrlKey: true });
    // With Control no longer held, the same events read as a pinch: both axes.
    expect(zoomSince(released).time).toBeCloseTo(Math.exp((-5 * macNotch) / 100), 6);
  });

  it("applies continuous updates too small to see one at a time", () => {
    // Each event zooms by less than 1.0001; together they zoom by exp(4 / 100).
    const tiny = Array(500).fill(-0.008);
    const pinchCanvas = mount(TrackRender.Spline);
    const beforePinch = snapshot();
    wheelStream(pinchCanvas, tiny, { ctrlKey: true });
    const pinch = zoomSince(beforePinch);
    expect(pinch.time).toBeCloseTo(Math.exp(0.04), 6);
    expect(pinch.value).toBeCloseTo(Math.exp(0.04), 6);

    const beforeScroll = snapshot();
    wheelStream(pinchCanvas, tiny, { metaKey: true });
    expect(zoomSince(beforeScroll).value).toBeCloseTo(Math.exp(0.04), 6);
  });

  it("zooms both axes by the scale the fingers made for a trackpad pinch", () => {
    const canvas = mount(TrackRender.Spline);
    const before = snapshot();
    wheelStream(canvas, pinchDeltas(1.5, 15), { ctrlKey: true });
    const zoom = zoomSince(before);
    expect(zoom.time).toBeCloseTo(1.5, 6);
    expect(zoom.value).toBeCloseTo(1.5, 6);
  });

  it("keeps both axes in step when a pinch reaches one axis's zoom limit", () => {
    const canvas = mount(TrackRender.Spline);
    const start = snapshot();
    // Zoom the value axis in first, so it reaches its 10x limit before time does.
    wheelStream(canvas, [-100, -100, -100, -100, -100], { metaKey: true });
    const beforePinch = snapshot();
    wheelStream(canvas, pinchDeltas(20, 20), { ctrlKey: true });
    const pinchZoom = zoomSince(beforePinch);
    expect(zoomSince(start).value).toBeCloseTo(10, 6);
    expect(pinchZoom.time).toBeCloseTo(pinchZoom.value, 6);
    expect(pinchZoom.time).toBeCloseTo(10 / 1.1 ** 5, 6);
  });
});

// Safari's gesture events and touchscreens reach `onPinch`, whose `offset` is the
// gesture's cumulative scale since it began.
describe("PanZoomControls touch pinch", () => {
  it("zooms by the fingers' scale, and each pinch starts from the zoom the last one left", () => {
    const canvas = mount(TrackRender.Key);
    const before = snapshot();
    touchPinch(canvas, gapsTo(2));
    const one = zoomSince(before).time;
    touchPinch(canvas, gapsTo(2));
    const two = zoomSince(before).time;
    // The pinch threshold (0.001) leaves each 2x pinch at 1.999x.
    expect(one).toBeCloseTo(2, 2);
    expect(two).toBeCloseTo(one * one, 6);
  });

  it("zooms the axis the fingers are spread along in Spline mode", () => {
    const canvas = mount(TrackRender.Spline);
    const beforeHorizontal = snapshot();
    touchPinch(canvas, gapsTo(2), "horizontal");
    const horizontal = zoomSince(beforeHorizontal);
    expect(horizontal.time).toBeCloseTo(2, 2);
    expect(horizontal.value).toBeCloseTo(1, 6);

    const beforeVertical = snapshot();
    touchPinch(canvas, gapsTo(2), "vertical");
    const vertical = zoomSince(beforeVertical);
    expect(vertical.value).toBeCloseTo(2, 2);
    expect(vertical.time).toBeCloseTo(1, 6);
  });

  it("calls onStart and onEnd once per pinch, including one whose first move is below the threshold", () => {
    const calls: string[] = [];
    const canvas = mount(TrackRender.Key, {
      onStart: () => calls.push("start"),
      onEnd: () => calls.push("end"),
    });
    touchPinch(canvas, gapsTo(2));
    touchPinch(canvas, [100.05, 150, 200]);
    // A pinch that never crosses the threshold zooms nothing and reports nothing.
    touchPinch(canvas, [100.02]);
    expect(calls).toEqual(["start", "end", "start", "end"]);
  });

  it("drops the stretch of a pinch made while an overlay is open", () => {
    const calls: string[] = [];
    const canvas = mount(TrackRender.Key, {
      onStart: () => calls.push("start"),
      onEnd: () => calls.push("end"),
    });
    const before = snapshot();
    const hasInteractiveOverlay = useTooltipStore.getState().hasInteractiveOverlay;
    useTooltipStore.setState({ hasInteractiveOverlay: () => true });
    try {
      touch(canvas, "touchstart", 100);
      touch(canvas, "touchmove", 150);
    } finally {
      useTooltipStore.setState({ hasInteractiveOverlay });
    }
    touch(canvas, "touchmove", 200);
    touch(canvas, "touchend", null);
    expect(zoomSince(before).time).toBeCloseTo(200 / 150, 2);
    expect(calls).toEqual(["start", "end"]);
  });
});
