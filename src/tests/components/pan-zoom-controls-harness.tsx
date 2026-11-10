import type { ComponentProps } from "react";
import { act, render } from "@testing-library/react";
import { OrthographicCamera } from "three";
import { vi } from "vitest";
import { PanZoomControls } from "../../components/controls/pan-zoom-controls";
import { splineCameraYMotion, viewportMotion } from "../../viewport-state";
import { TrackRender } from "../../types";

/**
 * Shared fixture for the `PanZoomControls` tests. A test file mocks
 * `@react-three/fiber` so that `useThree()` returns `host.three`, which `mount` fills
 * with a real orthographic camera and a sized canvas element. The gesture bindings
 * `PanZoomControls` installs on that element are use-gesture's real ones, so a test
 * sees every handler an event reaches.
 */
export interface ThreeHost {
  three: unknown;
}

export const WIDTH = 1000;
export const HEIGHT = 400;

type Spread = "horizontal" | "vertical";

export function mount(
  host: ThreeHost,
  trackRender: TrackRender,
  props: Partial<ComponentProps<typeof PanZoomControls>> = {},
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  Object.defineProperty(canvas, "clientWidth", { value: WIDTH });
  canvas.getBoundingClientRect = () => new DOMRect(0, 0, WIDTH, HEIGHT);
  document.body.append(canvas);
  host.three = {
    camera: new OrthographicCamera(0, WIDTH, HEIGHT / 2, -HEIGHT / 2),
    gl: { domElement: canvas },
    size: { width: WIDTH, height: HEIGHT },
  };
  render(
    <PanZoomControls
      trackRegion={{ top: 0, bottom: 0 }}
      contentHeightPx={HEIGHT * 4}
      trackRender={trackRender}
      {...props}
    />,
  );
  return canvas;
}

export function snapshot() {
  const [left, right] = viewportMotion.get();
  const { top, bottom } = splineCameraYMotion.get();
  return { width: right - left, height: top - bottom };
}

/** How far each axis zoomed in since `before`: >1 is in, <1 is out. */
export function zoomSince(before: { width: number; height: number }) {
  const now = snapshot();
  return { time: before.width / now.width, value: before.height / now.height };
}

export function wheel(canvas: HTMLCanvasElement, init: WheelEventInit): WheelEvent {
  const event = new WheelEvent("wheel", {
    bubbles: true,
    cancelable: true,
    clientX: WIDTH / 2,
    clientY: HEIGHT / 2,
    ...init,
  });
  act(() => {
    canvas.dispatchEvent(event);
  });
  return event;
}

/** Wheel events 16ms apart, then a wait past every gesture's end timeout. Needs fake timers. */
export function wheelStream(
  canvas: HTMLCanvasElement,
  deltas: number[],
  init: WheelEventInit,
): void {
  for (const deltaY of deltas) {
    wheel(canvas, { ...init, deltaY });
    act(() => {
      vi.advanceTimersByTime(16);
    });
  }
  act(() => {
    vi.advanceTimersByTime(1000);
  });
}

/** `n` pinch events whose combined finger scale is `scale`, as Chromium encodes them. */
export function pinchDeltas(scale: number, n: number): number[] {
  return Array.from({ length: n }, () => (-100 * Math.log(scale)) / n);
}

/** Finger gaps, in px, for a pinch from 100px apart to `100 * scale` px apart in four moves. */
export function gapsTo(scale: number): number[] {
  return [1, 2, 3, 4].map((i) => 100 * (1 + ((scale - 1) * i) / 4));
}

/** Two finger positions `gap` px apart about the canvas centre. */
function fingers(gap: number, spread: Spread): { x: number; y: number }[] {
  const cx = WIDTH / 2;
  const cy = HEIGHT / 2;
  return [-gap / 2, gap / 2].map((d) => ({
    x: spread === "horizontal" ? cx + d : cx,
    y: spread === "vertical" ? cy + d : cy,
  }));
}

/** A touch event with two fingers `gap` px apart; `gap` null lifts both. */
export function touch(
  canvas: HTMLCanvasElement,
  type: string,
  gap: number | null,
  spread: Spread = "horizontal",
) {
  const touches =
    gap === null
      ? []
      : fingers(gap, spread).map((p, i) => ({
          identifier: i + 1,
          target: canvas,
          clientX: p.x,
          clientY: p.y,
        }));
  const changed =
    gap === null ? [1, 2].map((identifier) => ({ identifier, target: canvas })) : touches;
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    touches: { value: touches },
    targetTouches: { value: touches },
    changedTouches: { value: changed },
  });
  act(() => {
    canvas.dispatchEvent(event);
  });
}

/**
 * A two-finger touch pinch starting 100px apart and moving through `gaps`. jsdom
 * has `ontouchstart` and no pointer or gesture events, so use-gesture reads pinches
 * from touch events there.
 */
export function touchPinch(
  canvas: HTMLCanvasElement,
  gaps: number[],
  spread: Spread = "horizontal",
): void {
  touch(canvas, "touchstart", 100, spread);
  for (const gap of gaps) touch(canvas, "touchmove", gap, spread);
  touch(canvas, "touchend", null, spread);
}

function pointer(canvas: HTMLCanvasElement, type: string, id: number, x: number, y: number) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    pointerId: { value: id },
    pointerType: { value: "touch" },
    buttons: { value: type === "pointerup" ? 0 : 1 },
    clientX: { value: x },
    clientY: { value: y },
  });
  act(() => {
    canvas.dispatchEvent(event);
  });
}

/**
 * A two-finger pinch as pointer events, starting 100px apart and moving through
 * `gaps`: what use-gesture reads in a browser with pointer events (Chromium, Safari).
 */
export function pointerPinch(
  canvas: HTMLCanvasElement,
  gaps: number[],
  spread: Spread = "horizontal",
): void {
  fingers(100, spread).forEach((p, i) => pointer(canvas, "pointerdown", i + 1, p.x, p.y));
  for (const gap of gaps) {
    fingers(gap, spread).forEach((p, i) => pointer(canvas, "pointermove", i + 1, p.x, p.y));
  }
  const last = fingers(gaps[gaps.length - 1], spread);
  last.forEach((p, i) => pointer(canvas, "pointerup", i + 1, p.x, p.y));
}

/**
 * Press or release a physical Control key (`code` names which one), as the page's
 * key events report it: `ctrlKey` is the modifier state with the event applied, so
 * a release reads `ctrlKey: true` while the other Control key is still down.
 */
export function controlKey(
  type: "keydown" | "keyup",
  { code = "ControlLeft", otherControlHeld = false } = {},
): void {
  act(() => {
    document.dispatchEvent(
      new KeyboardEvent(type, {
        key: "Control",
        code,
        ctrlKey: type === "keydown" || otherControlHeld,
        bubbles: true,
      }),
    );
  });
}
