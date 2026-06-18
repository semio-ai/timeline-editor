import { useCallback, useContext, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { isOrthographicCamera } from "@semio/utils";
import { TrackRender } from "../types";
import { AnimationContext } from "../context";
import { getDataViewportFromFrustum, setFrustumFromDataViewport } from "../viewport-utils";
import { setViewport, panVertical } from "../viewport-state";

// Tuning: chosen by feel, not derived from any UX research. Adjust together —
// the feel comes from the *ratio* between zone width and max speed (pixels of
// pointer travel per second of scroll), not the absolute values. Keep
// horizontal speed in world-units (ms) so 1× timeline zoom matches a sensible
// pointer cadence; vertical speed is in CSS pixels because the non-spline
// path scrolls a pixel-aligned row list.

/** Width of the edge zone (in pixels) where scrolling activates. */
const EDGE_ZONE_PX = 40;

/** Maximum horizontal scroll speed in world-units (ms) per second. */
const MAX_HORIZONTAL_SPEED = 2000;

/** Maximum vertical scroll speed in pixels per second. */
const MAX_VERTICAL_SPEED = 200;

export interface EdgeScrollConfig {
  /** Pixel offset of the data area from the top of the canvas (ruler height). */
  topOffsetPx?: number;
  /** Pixel offset of the data area from the bottom of the canvas (timeline + minimap). */
  bottomOffsetPx?: number;
  /** Per-row height in pixels (for non-spline scroll bounds). */
  trackHeightPx?: number;
  /**
   * Number of visible (post-filter) rows. Used to compute the vertical
   * scroll bound so scrolling stops at the end of the rendered content,
   * not the end of the unfiltered source list.
   */
  contentRowCount?: number;
  /** Whether to enable horizontal edge-scrolling. Default true. */
  horizontal?: boolean;
  /** Whether to enable vertical edge-scrolling. Default true. */
  vertical?: boolean;
}

export interface EdgeScrollHandle {
  /** Call on every pointer move during the gesture with current screen coords. */
  updatePointer: (clientX: number, clientY: number) => void;
  /** Start the edge-scroll rAF loop. Call once when the gesture activates. */
  start: () => void;
  /** Stop the edge-scroll rAF loop. Call on gesture end. */
  stop: () => void;
  /**
   * Cumulative world-space shift applied since the last `start()`.
   * Consumers that compute drag position from pixel movement need to add
   * this to compensate for the viewport moving under the pointer.
   */
  shiftX: React.RefObject<number>;
}

/**
 * Reusable edge-scrolling engine for any drag gesture.
 *
 * When the pointer is near the edge of the data area, the viewport auto-scrolls
 * at a speed proportional to the distance from the edge. Vertical scrolling
 * dispatches by mode through `panVertical` (spline: camera Y; non-spline:
 * row-bounded track scroll).
 *
 * Returns an imperative handle — the consumer calls `start()`, feeds pointer
 * positions via `updatePointer()`, and calls `stop()` when done.
 *
 * @param config - Layout and axis configuration
 * @param trackRender - Current track render mode (determines vertical scroll behavior)
 * @param onViewportShift - Optional callback fired after each scroll frame, allowing
 *   the consumer to update its own state (e.g. box-select hit rect, drag position).
 *   Receives the current camera so the consumer can recompute world coords.
 */
export function useEdgeScroll(
  config: EdgeScrollConfig,
  trackRender: TrackRender,
  onViewportShift?: () => void,
): EdgeScrollHandle {
  const { camera, gl, size } = useThree();
  const animationStore = useContext(AnimationContext);

  const cameraRef = useRef(camera);
  cameraRef.current = camera;
  const canvasRef = useRef(gl.domElement);
  canvasRef.current = gl.domElement;
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const configRef = useRef(config);
  configRef.current = config;
  const trackRenderRef = useRef(trackRender);
  trackRenderRef.current = trackRender;
  const onViewportShiftRef = useRef(onViewportShift);
  onViewportShiftRef.current = onViewportShift;

  const velocityRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const shiftXRef = useRef<number>(0);
  const pointerRef = useRef<{ clientX: number; clientY: number }>({ clientX: 0, clientY: 0 });
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  const computeVelocity = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } => {
      const rect = canvasRef.current.getBoundingClientRect();
      const cfg = configRef.current;
      const topOffset = cfg.topOffsetPx ?? 36;
      const bottomOffset = cfg.bottomOffsetPx ?? 108;
      const enableH = cfg.horizontal !== false;
      const enableV = cfg.vertical !== false;

      let vx = 0;
      let vy = 0;

      if (enableH) {
        const distFromLeft = clientX - rect.left;
        const distFromRight = rect.right - clientX;
        if (distFromLeft < EDGE_ZONE_PX) {
          vx = -MAX_HORIZONTAL_SPEED * (1 - Math.max(0, distFromLeft) / EDGE_ZONE_PX);
        } else if (distFromRight < EDGE_ZONE_PX) {
          vx = MAX_HORIZONTAL_SPEED * (1 - Math.max(0, distFromRight) / EDGE_ZONE_PX);
        }
      }

      if (enableV) {
        const dataTop = rect.top + topOffset;
        const dataBottom = rect.bottom - bottomOffset;
        const distFromTop = clientY - dataTop;
        const distFromBottom = dataBottom - clientY;
        if (distFromTop < EDGE_ZONE_PX && clientY >= dataTop - EDGE_ZONE_PX) {
          vy = -MAX_VERTICAL_SPEED * (1 - Math.max(0, distFromTop) / EDGE_ZONE_PX);
        } else if (distFromBottom < EDGE_ZONE_PX && clientY <= dataBottom + EDGE_ZONE_PX) {
          vy = MAX_VERTICAL_SPEED * (1 - Math.max(0, distFromBottom) / EDGE_ZONE_PX);
        }
      }

      return { x: vx, y: vy };
    },
    [],
  );

  const applyScroll = useCallback(
    (dt: number) => {
      const vel = velocityRef.current;
      if (vel.x === 0 && vel.y === 0) return;

      const cam = cameraRef.current;
      if (!isOrthographicCamera(cam)) return;

      // --- Horizontal: shift camera frustum and accumulate shift ---
      if (vel.x !== 0) {
        const deltaWorld = vel.x * dt;
        shiftXRef.current += deltaWorld;
        const { width } = sizeRef.current;
        const dataVp = getDataViewportFromFrustum(
          { left: cam.left, right: cam.right },
          Math.max(1, width),
        );
        const newLeft = dataVp.left + deltaWorld;
        const newRight = dataVp.right + deltaWorld;
        setViewport(newLeft, newRight);
        const frustum = setFrustumFromDataViewport(
          { left: newLeft, right: newRight },
          Math.max(1, width),
        );
        cam.left = frustum.left;
        cam.right = frustum.right;
        cam.updateProjectionMatrix();
      }

      // --- Vertical: dispatched by mode through viewport-state ---
      if (vel.y !== 0) {
        const { height } = sizeRef.current;
        const cfg = configRef.current;
        const topOff = cfg.topOffsetPx ?? 36;
        const bottomOff = cfg.bottomOffsetPx ?? 108;
        const trackH = cfg.trackHeightPx ?? 36;
        const store = animationStore?.getState();
        // Prefer the caller-provided filtered row count; fall back to the
        // unfiltered store list only if not supplied (legacy callers).
        const rowCount =
          cfg.contentRowCount ??
          (store?.sourceRowIds
            ? Array.isArray(store.sourceRowIds)
              ? store.sourceRowIds.length
              : store.sourceRowIds.flat.length
            : 0);
        const contentHeight = rowCount * trackH;
        panVertical(vel.y * dt, {
          mode: trackRenderRef.current,
          canvasHeight: height,
          contentHeight,
          topOffsetPx: topOff,
          bottomOffsetPx: bottomOff,
        });
      }

      onViewportShiftRef.current?.();
    },
    [animationStore],
  );

  const loop = useCallback(
    (now: number) => {
      const dt = lastTimeRef.current ? (now - lastTimeRef.current) / 1000 : 0;
      lastTimeRef.current = now;
      applyScroll(Math.min(dt, 0.1));
      rafRef.current = requestAnimationFrame(loop);
    },
    [applyScroll],
  );

  const updatePointer = useCallback(
    (clientX: number, clientY: number) => {
      pointerRef.current = { clientX, clientY };
      velocityRef.current = computeVelocity(clientX, clientY);
    },
    [computeVelocity],
  );

  const start = useCallback(() => {
    if (rafRef.current !== null) return;
    shiftXRef.current = 0;
    lastTimeRef.current = 0;
    rafRef.current = requestAnimationFrame(loop);
  }, [loop]);

  const stop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    velocityRef.current = { x: 0, y: 0 };
  }, []);

  return { updatePointer, start, stop, shiftX: shiftXRef };
}
