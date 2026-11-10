/**
 * Wheel and pinch input arithmetic for the timeline's canvases. A zoom factor above
 * 1 zooms in (the visible range shrinks by that factor); below 1 zooms out.
 */

/** Which of the canvas's axes a zoom changes. Only Spline mode has a value axis. */
export enum ZoomAxis {
  Time = "time",
  Value = "value",
  Both = "both",
}

/** What produced a wheel event that zooms. It sets the zoom rate and, in spline mode, the axis. */
export enum ZoomWheelInput {
  /** A notched mouse wheel, held with Ctrl or Cmd. Zooms a fixed step per notch. */
  Notch = "notch",
  /**
   * A trackpad pinch. Chromium delivers a pinch as wheel events with `ctrlKey` set
   * while the Control key is not held, encoding the finger scale as
   * `deltaY = -100 · ln(scale)`.
   */
  Pinch = "pinch",
  /** Continuous input (a trackpad scroll, or any mouse wheel on macOS) held with Ctrl or Cmd. */
  Scroll = "scroll",
}

/** Pixels one wheel notch scrolls on Chromium for Windows and Linux. */
export const WHEEL_NOTCH_PX = 100;

/** Zoom factor per wheel notch at `zoomSpeed` 1. */
export const WHEEL_NOTCH_ZOOM = 1.1;

/**
 * Pixels of `deltaY` per unit of natural-log scale in a pinch delivered as wheel
 * events (Chromium: `deltaY = -100 · ln(scale)`). Continuous scrolls use the same
 * constant, so a Cmd+scroll zooms at the rate of a pinch of the same delta.
 */
export const PINCH_DELTA_PER_LOG_SCALE = 100;

/** Pixels per line and per page for a wheel event in line or page mode, as use-gesture counts them. */
const WHEEL_LINE_PX = 40;
const WHEEL_PAGE_PX = 800;

/** Lines one notch scrolls in line mode (Firefox's default). */
const WHEEL_NOTCH_LINES = 3;

/** Pages one notch scrolls in page mode. */
const WHEEL_NOTCH_PAGES = 1;

/** A wheel event's `[deltaX, deltaY]` in pixels, whatever its `deltaMode`. */
export function wheelDeltaPx(
  event: Pick<WheelEvent, "deltaX" | "deltaY" | "deltaMode">,
): [number, number] {
  let pxPerUnit = 1;
  if (event.deltaMode === 1) {
    pxPerUnit = WHEEL_LINE_PX;
  } else if (event.deltaMode === 2) {
    pxPerUnit = WHEEL_PAGE_PX;
  }
  return [event.deltaX * pxPerUnit, event.deltaY * pxPerUnit];
}

/** One notch, in `wheelDeltaPx` pixels, for a wheel event in the given `deltaMode`. */
function notchPx(deltaMode: number): number {
  if (deltaMode === 1) return WHEEL_NOTCH_LINES * WHEEL_LINE_PX;
  if (deltaMode === 2) return WHEEL_NOTCH_PAGES * WHEEL_PAGE_PX;
  return WHEEL_NOTCH_PX;
}

/**
 * Whether a wheel event came from a notched mouse wheel (one notch ≈ 100–120px per
 * event) rather than a trackpad (fractional, pixel-precise deltas of ~1–10px).
 * Callers damp a notch's vertical scroll by `panSpeed` and zoom it at the notch
 * rate; continuous input scrolls 1:1 and zooms at the pinch rate.
 *
 *   - `deltaMode !== 0` (Firefox line/page mode): always a wheel.
 *   - `deltaMode === 0` with `|delta| >= 50` and integer-valued: a Chromium wheel
 *     notch on Windows or Linux. Trackpads emit fractional deltas during smooth
 *     scrolling, so the integer-and-large guard excludes them.
 *
 * Two kinds of mouse read as continuous input, so they skip the notch damping and
 * their vertical scroll is taken 1:1, like a trackpad's. Chromium on macOS reports a
 * mouse wheel in accelerated, fractional pixels (a slow notch is roughly 4–12px),
 * and Linux high-resolution mice emit fractional deltas on Chromium. The heuristic
 * accepts that because the opposite misreading is more disruptive: trackpad
 * inertial scrolling read as notches would make long trackpad pans sluggish.
 *
 * The classification is per event, so input whose events fall either side of the
 * boundary (integer deltas around 50px) changes zoom rate between them. A trackpad's
 * deltas are fractional, so it never reads as notches.
 *
 * Pass the axis the gesture actually carried (deltaX for Shift+wheel on Chromium,
 * deltaY otherwise); the classification is per axis.
 */
export function isLikelyMouseWheel(event: Pick<WheelEvent, "deltaMode">, delta: number): boolean {
  if (event.deltaMode !== 0) return true;
  return Math.abs(delta) >= 50 && Number.isInteger(delta);
}

/**
 * Classify a wheel event held with Ctrl or Cmd. `delta` is its dominant-axis delta;
 * `controlKeyHeld` is whether the Control key is physically down, which a wheel
 * event's own `ctrlKey` cannot say (see `useControlKeyHeld`).
 */
export function classifyZoomWheel(
  event: Pick<WheelEvent, "deltaMode" | "ctrlKey">,
  delta: number,
  controlKeyHeld: boolean,
): ZoomWheelInput {
  if (isLikelyMouseWheel(event, delta)) return ZoomWheelInput.Notch;
  if (event.ctrlKey && !controlKeyHeld) return ZoomWheelInput.Pinch;
  return ZoomWheelInput.Scroll;
}

/**
 * Zoom factor for one wheel event's dominant-axis delta in `wheelDeltaPx` pixels
 * (positive scrolls down, which zooms out).
 *
 * Every input zooms in proportion to its delta, so a stream zooms by its total
 * however the browser splits or coalesces it into events. A notch zooms
 * `WHEEL_NOTCH_ZOOM` per notch's worth of delta: 100px in pixel mode, 3 lines in
 * line mode, one page in page mode. A mouse whose notch is larger (some Windows
 * settings give 120px) zooms that much further per notch, as it also scrolls that
 * much further. Continuous input inverts Chromium's pinch encoding, so a pinch zooms
 * by exactly the scale the fingers made. `zoomSpeed` scales the zoom's exponent, so
 * in and out stay symmetric at any speed.
 */
export function wheelZoomFactor(
  delta: number,
  input: ZoomWheelInput,
  zoomSpeed: number,
  deltaMode = 0,
): number {
  if (delta === 0) return 1;
  if (input === ZoomWheelInput.Notch) {
    return WHEEL_NOTCH_ZOOM ** ((-delta / notchPx(deltaMode)) * zoomSpeed);
  }
  return Math.exp((-delta / PINCH_DELTA_PER_LOG_SCALE) * zoomSpeed);
}

/**
 * The axis two fingers are spread along, from use-gesture's finger angle in degrees
 * (`-atan2(dx, dy)`: ±90 for fingers side by side, 0 or ±180 for one above the
 * other).
 */
export function fingerSpreadAxis(angleDegrees: number): ZoomAxis {
  const radians = (angleDegrees * Math.PI) / 180;
  return Math.abs(Math.sin(radians)) > Math.abs(Math.cos(radians)) ? ZoomAxis.Time : ZoomAxis.Value;
}

/**
 * Zoom factor for one update of a pinch gesture whose cumulative scale since the
 * gesture began moved from `previousScale` to `scale`. Applying each update's
 * factor in turn zooms by the gesture's cumulative scale raised to `zoomSpeed`, and
 * an update that repeats the previous scale, as a gesture's final update does,
 * zooms by 1.
 */
export function pinchStepFactor(previousScale: number, scale: number, zoomSpeed: number): number {
  if (previousScale <= 0 || scale <= 0) return 1;
  return (scale / previousScale) ** zoomSpeed;
}
