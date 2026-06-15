import { useEffect, useRef, forwardRef, memo } from "react";
import { useThree } from "@react-three/fiber";
import { OrthographicCamera, Vector2 } from "three";
import { isOrthographicCamera } from "@semio/utils";
import { useTooltipStore } from "@semio/ui";
import { useGesture } from "@use-gesture/react";
import {
  calculatePaddedFrustum,
  getDataViewportFromFrustum,
  setFrustumFromDataViewport,
} from "../../viewport-utils";
import {
  viewportMotion,
  setViewport,
  splineCameraYMotion,
  panVertical,
  zoomVertical,
} from "../../viewport-state";
import { TrackRender } from "../../types";

/**
 * Detect whether a wheel event originated from a discrete mouse wheel
 * (one detent ≈ 100–120px per event) versus a trackpad (fractional,
 * pixel-precise deltas of ~1–10px). Mouse wheels feel aggressive when
 * mapped 1:1 to viewport units, so callers can dampen them with
 * `panSpeed`; trackpads should map 1:1 to stay smooth.
 *
 * Heuristic:
 *   - `deltaMode !== 0` (Firefox line/page mode): always a wheel.
 *   - `deltaMode === 0` with `|delta| >= 50` and integer-valued:
 *     a Chrome/Edge/Safari wheel detent. Trackpads on the same browsers
 *     emit sub-10px fractional deltas during smooth scrolling, so the
 *     integer-and-large guard excludes them reliably.
 *
 * Pass whichever axis the gesture actually carried (deltaX for shift+wheel
 * on Chromium browsers, deltaY otherwise) — the classification is per-axis.
 */
function isLikelyMouseWheel(event: WheelEvent, delta: number): boolean {
  if (event.deltaMode !== 0) return true;
  return Math.abs(delta) >= 50 && Number.isInteger(delta);
}

export interface PanZoomControlsProps {
  enabled?: boolean;
  enablePan?: boolean;
  enableZoom?: boolean;
  panSpeed?: number;
  zoomSpeed?: number;
  minZoom?: number;
  maxZoom?: number;
  onChange?: () => void;
  onStart?: () => void;
  onEnd?: () => void;
  bounds?: [number, number];
  trackRegion?: { top: number; bottom: number };
  contentHeightPx?: number;
  trackRender?: TrackRender;
  /**
   * Whether this PanZoomControls should write the canvas's `camera.left/right`
   * directly when the viewport changes. Default `true` — used by the main
   * (tracks) canvas where no other system manages X-frustum. Set to `false`
   * for the top canvas (whose `CanvasCamera mode="moving"` already mirrors
   * `viewportMotion`) and the bottom canvas (whose camera is fixed at
   * `[0, duration]` and must NOT follow the panned viewport). When `false`,
   * gestures still write to `viewportMotion`; the canvas's own camera is
   * managed by its `CanvasCamera`.
   */
  manageCamera?: boolean;
}

interface PanZoomControlsRef {
  enabled: boolean;
  enablePan: boolean;
  enableZoom: boolean;
  panSpeed: number;
  zoomSpeed: number;
  minZoom: number;
  maxZoom: number;
  bounds?: [number, number];
  trackRegion?: { top: number; bottom: number };
  contentHeightPx?: number;
  getFrustum: () => { left: number; right: number; top: number; bottom: number };
  update: () => boolean;
}

const InnerPanZoomControls = forwardRef<PanZoomControlsRef, PanZoomControlsProps>(
  (
    {
      enabled = true,
      enablePan = true,
      enableZoom = true,
      panSpeed = 0.25,
      zoomSpeed = 1.0,
      minZoom = 0.1,
      maxZoom = 10,
      onChange,
      onStart,
      onEnd,
      bounds,
      trackRegion,
      contentHeightPx,
      trackRender,
      manageCamera = true,
    },
    ref,
  ) => {
    const { camera, gl, size } = useThree();
    const initialCameraWidth = useRef(0);
    const initialCameraHeight = useRef(0);
    const viewportRef = useRef<[number, number]>(viewportMotion.get());

    // Store current settings in refs for gesture handlers
    const settingsRef = useRef({
      enabled,
      enablePan,
      enableZoom,
      panSpeed,
      zoomSpeed,
      minZoom,
      maxZoom,
      bounds,
      trackRegion,
      contentHeightPx,
      trackRender,
    });

    // Update settings ref when props change
    useEffect(() => {
      settingsRef.current = {
        enabled,
        enablePan,
        enableZoom,
        panSpeed,
        zoomSpeed,
        minZoom,
        maxZoom,
        bounds,
        trackRegion,
        contentHeightPx,
        trackRender,
      };
    }, [
      enabled,
      enablePan,
      enableZoom,
      panSpeed,
      zoomSpeed,
      minZoom,
      maxZoom,
      bounds,
      trackRegion,
      contentHeightPx,
      trackRender,
    ]);

    // Setup player store integration. Only when this PanZoomControls is
    // responsible for writing the canvas's camera (`manageCamera`). For the
    // top/bottom canvases, `CanvasCamera` already handles camera updates;
    // this component is just the gesture handler there.
    useEffect(() => {
      if (!manageCamera) {
        // Still capture initialCameraWidth so zoom limits work — read from
        // the viewport directly instead of camera.
        if (initialCameraWidth.current <= 0) {
          const vp = viewportMotion.get();
          initialCameraWidth.current = vp[1] - vp[0];
        }
        return;
      }
      if (!(camera instanceof OrthographicCamera) || size.width <= 0) {
        return;
      }

      const applyViewport = (vp: [number, number]) => {
        const { left, right } = calculatePaddedFrustum(vp, size.width);
        camera.left = left;
        camera.right = right;
        camera.updateProjectionMatrix();
        // Only set initial width once — it anchors the zoom min/max range
        if (initialCameraWidth.current <= 0) {
          initialCameraWidth.current = vp[1] - vp[0];
        }
        // Note: initialCameraHeight is captured lazily in effectiveVerticalFactor
        // because this effect runs before TracksRenderer initializes camera Y.
      };

      // Subscribe to viewport MotionValue changes
      const unsubscribe = viewportMotion.on("change", (vp) => {
        if (size.width > 0) {
          viewportRef.current = vp;
          applyViewport(vp);
        }
      });

      // Initialize camera bounds
      applyViewport(viewportRef.current);

      return unsubscribe;
    }, [camera, size.width, manageCamera]);

    // Pan camera function. The thing being panned is always the main viewport
    // (`viewportMotion`); the source canvas's camera is read only to scale the
    // pixel delta to data units (so the user feel matches the canvas's view —
    // top + main pan at the main viewport's rate, bottom pans at the
    // full-duration rate, matching minimap-style "scrubber" UX).
    const panCamera = (deltaX: number) => {
      if (!(camera instanceof OrthographicCamera) || !settingsRef.current.enablePan) return;

      const canvasWidth = gl.domElement?.clientWidth || 1;
      const canvasViewport = getDataViewportFromFrustum(
        { left: camera.left, right: camera.right },
        canvasWidth,
      );
      const canvasDataWidth = canvasViewport.right - canvasViewport.left;
      // Convert pixel delta to world units using THIS CANVAS's data range.
      const adjustedDeltaX =
        (deltaX / canvasWidth) * canvasDataWidth * settingsRef.current.panSpeed;

      // Apply delta to the main viewport — what we always update.
      const [vpLeft, vpRight] = viewportMotion.get();
      const dataWidth = vpRight - vpLeft;
      let newDataLeft = vpLeft + adjustedDeltaX;
      let newDataRight = vpRight + adjustedDeltaX;

      // Apply bounds checking
      if (settingsRef.current.bounds) {
        const [min, max] = settingsRef.current.bounds;
        if (dataWidth >= max - min) {
          newDataLeft = min;
          newDataRight = max;
        } else {
          if (newDataLeft < min) {
            newDataLeft = min;
            newDataRight = min + dataWidth;
          }
          if (newDataRight > max) {
            newDataRight = max;
            newDataLeft = max - dataWidth;
          }
        }
      }

      // Update this canvas's camera directly when we manage it; otherwise
      // CanvasCamera will pick up the viewportMotion change.
      if (manageCamera) {
        const newFrustum = setFrustumFromDataViewport(
          { left: newDataLeft, right: newDataRight },
          canvasWidth,
        );
        camera.left = newFrustum.left;
        camera.right = newFrustum.right;
        camera.updateProjectionMatrix();
      }

      setViewport(newDataLeft, newDataRight);
    };

    // Zoom main viewport horizontally. Cursor data position is computed from
    // THIS CANVAS's data range — for top/main this is the main viewport (so
    // the cursor stays at the same screen point as zoom changes), for bottom
    // this is `[0, duration]` (so ctrl+wheel on the bottom zooms main into
    // the timeline area under the cursor). Width comes from the main
    // viewport since we're zooming THAT (not the canvas's own range).
    const zoomCameraHorizontal = (zoomFactor: number, center: Vector2) => {
      if (
        !(camera instanceof OrthographicCamera) ||
        !settingsRef.current.enableZoom ||
        !gl.domElement
      )
        return;

      const canvasWidth = gl.domElement.clientWidth;
      const rect = gl.domElement.getBoundingClientRect();

      // Cursor's data position in this canvas's data range.
      const canvasViewport = getDataViewportFromFrustum(
        { left: camera.left, right: camera.right },
        canvasWidth,
      );
      const relativeX = (center.x - rect.left) / rect.width;
      const cursorDataPos =
        canvasViewport.left + relativeX * (canvasViewport.right - canvasViewport.left);

      // Zoom width is computed from the main viewport's current width.
      const [vpLeft, vpRight] = viewportMotion.get();
      const currentDataWidth = vpRight - vpLeft;
      const minDataWidth = initialCameraWidth.current / settingsRef.current.maxZoom;
      const maxDataWidth = initialCameraWidth.current / settingsRef.current.minZoom;
      const newDataWidth = Math.max(
        minDataWidth,
        Math.min(maxDataWidth, currentDataWidth / zoomFactor),
      );

      if (Math.abs(newDataWidth - currentDataWidth) < 0.000001) return;

      // Anchor: cursor's data position becomes the same RELATIVE position
      // (relativeX) within the new main viewport.
      let newDataLeft = cursorDataPos - relativeX * newDataWidth;
      let newDataRight = newDataLeft + newDataWidth;

      // Apply bounds checking
      if (settingsRef.current.bounds) {
        const [min, max] = settingsRef.current.bounds;
        if (newDataLeft < min) {
          newDataLeft = min;
          newDataRight = min + newDataWidth;
        }
        if (newDataRight > max) {
          newDataRight = max;
          newDataLeft = max - newDataWidth;
        }
        if (newDataRight - newDataLeft > max - min) {
          newDataLeft = min;
          newDataRight = max;
        }
      }

      if (manageCamera) {
        const newFrustum = setFrustumFromDataViewport(
          { left: newDataLeft, right: newDataRight },
          canvasWidth,
        );
        camera.left = newFrustum.left;
        camera.right = newFrustum.right;
        camera.updateProjectionMatrix();
      }

      setViewport(newDataLeft, newDataRight);
    };

    // Apply a vertical wheel delta to the centralized vertical-axis state.
    // Spline pans camera Y; non-spline advances the row scroll. The pointer
    // must be inside the track region in either mode — wheeling over a HUD
    // shouldn't move the canvas vertically.
    const applyVerticalScroll = (event: { deltaY: number; clientY: number }) => {
      const { trackRegion: tr, contentHeightPx: ch, trackRender: mode } = settingsRef.current;
      const rect = gl.domElement?.getBoundingClientRect();
      if (!rect || !tr || typeof ch !== "number") return;
      const top = tr.top ?? 0;
      const bottom = tr.bottom ?? 0;
      const pointerY = event.clientY - rect.top;
      if (pointerY < top || pointerY > rect.height - bottom) return;
      panVertical(event.deltaY, {
        mode: mode ?? TrackRender.Key,
        canvasHeight: rect.height,
        contentHeight: ch,
        topOffsetPx: top,
        bottomOffsetPx: bottom,
      });
    };

    // Compute the effective zoom factor for horizontal axis after clamping.
    // Reads the current width from `viewportMotion` (the main viewport — what
    // we're zooming) rather than this canvas's camera, so the clamp is
    // correct regardless of which canvas the gesture originated in.
    const effectiveHorizontalFactor = (requestedFactor: number): number => {
      const [vpLeft, vpRight] = viewportMotion.get();
      const currentDataWidth = vpRight - vpLeft;
      if (initialCameraWidth.current <= 0 || currentDataWidth <= 0) return requestedFactor;
      const minDataWidth = initialCameraWidth.current / settingsRef.current.maxZoom;
      const maxDataWidth = initialCameraWidth.current / settingsRef.current.minZoom;
      const newDataWidth = Math.max(
        minDataWidth,
        Math.min(maxDataWidth, currentDataWidth / requestedFactor),
      );
      return currentDataWidth / newDataWidth;
    };

    // Compute the effective zoom factor for vertical axis after clamping.
    // Reads from splineCameraYMotion (the source of truth) rather than the
    // camera object so consecutive zoom calls see writes from the previous
    // call without waiting for the subscription to apply to the camera.
    const effectiveVerticalFactor = (requestedFactor: number): number => {
      const cy = splineCameraYMotion.get();
      const currentHeight = cy.top - cy.bottom;
      if (initialCameraHeight.current <= 1) {
        initialCameraHeight.current = size.height > 0 ? size.height : currentHeight;
      }
      if (initialCameraHeight.current <= 0 || currentHeight <= 0) return requestedFactor;
      const minHeight = initialCameraHeight.current / settingsRef.current.maxZoom;
      const maxHeight = initialCameraHeight.current / settingsRef.current.minZoom;
      const newHeight = Math.max(minHeight, Math.min(maxHeight, currentHeight / requestedFactor));
      return currentHeight / newHeight;
    };

    // Setup gesture handlers
    useGesture(
      {
        onWheel: ({ event, delta, ctrlKey, metaKey, shiftKey }) => {
          if (!settingsRef.current.enabled) return;
          // Block gestures while an interactive overlay (context menu, popover) is open
          if (useTooltipStore.getState().hasInteractiveOverlay()) return;

          const [deltaX, deltaY] = delta;
          const absDeltaX = Math.abs(deltaX);
          const absDeltaY = Math.abs(deltaY);
          const threshold = 0.5;

          onStart?.();

          const isSpline = settingsRef.current.trackRender === TrackRender.Spline;
          const isVerticalDominant = absDeltaY >= absDeltaX && absDeltaY > threshold;
          const isHorizontalDominant = absDeltaX > absDeltaY && absDeltaX > threshold;
          const hasCtrl = ctrlKey || metaKey;

          // --- Scroll: No modifier, vertical dominant ---
          // Vertical scroll/pan dispatched by mode in viewport-state. Mouse
          // wheels emit ~100–120px per detent vs trackpads' fractional sub-10px
          // events; mapping wheel detents 1:1 to camera-Y feels aggressive in
          // spline mode, so dampen them with `panSpeed`. Trackpads stay 1:1.
          if (!hasCtrl && !shiftKey && isVerticalDominant) {
            const wheelScale = isLikelyMouseWheel(event as WheelEvent, deltaY)
              ? settingsRef.current.panSpeed
              : 1;
            applyVerticalScroll({ deltaY: deltaY * wheelScale, clientY: event.clientY });
            event.preventDefault();
            onChange?.();
            onEnd?.();
            return;
          }

          // --- Scroll + Shift: Horizontal pan ---
          // Browsers disagree on which axis carries Shift+wheel: Firefox keeps
          // the wheel's deltaY, Chrome/Edge/Safari swap it into deltaX as their
          // built-in "horizontal-scroll from a vertical wheel" convention. Pan
          // on whichever axis the browser delivered so both cases work; a
          // trackpad Shift+horizontal-swipe also lands here harmlessly.
          if (!hasCtrl && shiftKey && (isVerticalDominant || isHorizontalDominant)) {
            if (settingsRef.current.enablePan) {
              panCamera(absDeltaX > absDeltaY ? deltaX : deltaY);
            }
            event.preventDefault();
            onChange?.();
            onEnd?.();
            return;
          }

          // --- Scroll: No modifier, horizontal dominant ---
          // Horizontal pan
          if (!hasCtrl && !shiftKey && isHorizontalDominant) {
            if (settingsRef.current.enablePan) {
              panCamera(deltaX);
            }
            event.preventDefault();
            onChange?.();
            onEnd?.();
            return;
          }

          event.preventDefault();

          // --- Ctrl/Cmd + Scroll: Zoom ---
          if (hasCtrl && settingsRef.current.enableZoom) {
            const dominantDelta = isVerticalDominant ? deltaY : deltaX;
            if (Math.abs(dominantDelta) <= threshold) {
              onChange?.();
              onEnd?.();
              return;
            }

            const baseZoomFactor = dominantDelta > 0 ? 0.9 : 1.1;
            const zoomFactor = 1 + (baseZoomFactor - 1) * settingsRef.current.zoomSpeed;

            if (shiftKey) {
              // Ctrl + Shift + Scroll: Horizontal zoom
              const center = new Vector2(event.clientX, event.clientY);
              zoomCameraHorizontal(zoomFactor, center);
            } else if (isSpline) {
              // Ctrl + Scroll (no Shift): Vertical zoom (spline only)
              const effV = effectiveVerticalFactor(zoomFactor);
              if (Math.abs(effV - 1) > 0.0001) {
                const rect = gl.domElement?.getBoundingClientRect();
                if (rect) {
                  zoomVertical(effV, event.clientY, {
                    mode: settingsRef.current.trackRender ?? TrackRender.Key,
                    canvasRect: rect,
                  });
                }
              }
            } else {
              // Ctrl + Scroll in non-spline: Horizontal zoom (no vertical axis)
              const center = new Vector2(event.clientX, event.clientY);
              zoomCameraHorizontal(zoomFactor, center);
            }
          }

          onChange?.();
          onEnd?.();
        },
        onPinch: ({ origin, first, last, offset: [scale], event }) => {
          if (!settingsRef.current.enabled || !settingsRef.current.enableZoom) return;
          if (useTooltipStore.getState().hasInteractiveOverlay()) return;

          if (first) {
            onStart?.();
          }

          event.preventDefault();

          const isSpline = settingsRef.current.trackRender === TrackRender.Spline;
          const scaleFactor = 1 + (scale - 1) * settingsRef.current.zoomSpeed * 0.5;

          // Determine zoom axis. Pinch+modifier-key combinations don't
          // round-trip reliably across platforms (notably Mac, where pinch
          // arrives as ctrl+wheel and additional modifiers are dropped),
          // so axis selection is gesture-only:
          // 1. Touch finger angle (if 2 fingers reported)
          // 2. Default: uniform (collapses to horizontal in non-spline since
          //    there's no vertical zoom axis there)
          // For modifier-driven axis selection, use scroll+modifier instead.
          const nativeEvent = event as TouchEvent;
          let zoomAxis: "horizontal" | "vertical" | "uniform" = "uniform";

          const touches = nativeEvent?.touches;
          if (touches?.length === 2) {
            const dx = Math.abs(touches[1].clientX - touches[0].clientX);
            const dy = Math.abs(touches[1].clientY - touches[0].clientY);
            zoomAxis = dx > dy ? "horizontal" : "vertical";
          }
          if (!isSpline && zoomAxis !== "horizontal") {
            zoomAxis = "horizontal";
          }

          // Apply zoom. Past this point, "uniform" and "vertical" only
          // appear for spline mode (non-spline was forced to horizontal).
          if (zoomAxis === "horizontal") {
            const center = new Vector2(origin[0], origin[1]);
            zoomCameraHorizontal(scaleFactor, center);
          } else if (zoomAxis === "uniform") {
            // Clamp to the more restrictive axis so both stay in sync
            const effH = effectiveHorizontalFactor(scaleFactor);
            const effV = effectiveVerticalFactor(scaleFactor);
            const uniformFactor = Math.abs(effH - 1) < Math.abs(effV - 1) ? effH : effV;
            if (Math.abs(uniformFactor - 1) > 0.0001) {
              const center = new Vector2(origin[0], origin[1]);
              zoomCameraHorizontal(uniformFactor, center);
              const rect = gl.domElement?.getBoundingClientRect();
              if (rect) {
                zoomVertical(uniformFactor, origin[1], {
                  mode: settingsRef.current.trackRender ?? TrackRender.Key,
                  canvasRect: rect,
                });
              }
            }
          } else {
            // vertical
            const effV = effectiveVerticalFactor(scaleFactor);
            if (Math.abs(effV - 1) > 0.0001) {
              const rect = gl.domElement?.getBoundingClientRect();
              if (rect) {
                zoomVertical(effV, origin[1], {
                  mode: settingsRef.current.trackRender ?? TrackRender.Key,
                  canvasRect: rect,
                });
              }
            }
          }

          onChange?.();

          if (last) {
            onEnd?.();
          }
        },
        // For now, disable drag handling because it messes with other drag events.
        // onDrag: ({ delta: [deltaX], first, last, event }) => {
        //   if (!settingsRef.current.enabled || !settingsRef.current.enablePan) return;

        //   if (first) {
        //     onStart?.();
        //   }

        //   event.preventDefault();

        //   panCamera(deltaX * settingsRef.current.panSpeed * 0.1);
        //   onChange?.();

        //   if (last) {
        //     onEnd?.();
        //   }
        // },
        onPointerDown: ({ event }) => {
          if (!settingsRef.current.enabled) return;
          // Prime the gesture system for better pinch detection
          event.preventDefault();
        },
        onPointerUp: ({ event }) => {
          if (!settingsRef.current.enabled) return;
          // Cleanup after gesture
          event.preventDefault();
        },
      },
      {
        target: gl.domElement,
        enabled,
        eventOptions: { passive: false },
        wheel: { eventOptions: { passive: false } },
        pinch: {
          eventOptions: { passive: false },
          threshold: 0.001,
          rubberband: false,
          triggerAllEvents: true,
          from: () => [1, 1],
        },
        drag: { eventOptions: { passive: false } },
        // pointer: { eventOptions: { passive: false } },
      },
    );

    // Set touch-action for proper gesture handling
    useEffect(() => {
      if (gl.domElement && enabled) {
        // Use "none" for most aggressive touch handling
        gl.domElement.style.touchAction = trackRender === TrackRender.Spline ? "pan-y" : "none";

        return () => {
          if (gl.domElement) {
            gl.domElement.style.touchAction = "auto";
          }
        };
      }
    }, [gl.domElement, enabled, trackRender]);

    // useGesture handles all event callbacks automatically

    // Expose ref methods
    useEffect(() => {
      if (ref) {
        const controlsRef = {
          enabled: settingsRef.current.enabled,
          enablePan: settingsRef.current.enablePan,
          enableZoom: settingsRef.current.enableZoom,
          panSpeed: settingsRef.current.panSpeed,
          zoomSpeed: settingsRef.current.zoomSpeed,
          minZoom: settingsRef.current.minZoom,
          maxZoom: settingsRef.current.maxZoom,
          bounds: settingsRef.current.bounds,
          trackRegion: settingsRef.current.trackRegion,
          contentHeightPx: settingsRef.current.contentHeightPx,
          getFrustum: () => {
            if (isOrthographicCamera(camera)) {
              return {
                left: camera.left,
                right: camera.right,
                top: camera.top,
                bottom: camera.bottom,
              };
            }
            return { left: 0, right: 0, top: 0, bottom: 0 };
          },
          update: () => false,
        };

        if (typeof ref === "function") {
          ref(controlsRef);
        } else {
          ref.current = controlsRef;
        }
      }
    }, [ref, camera]);

    return null;
  },
);

InnerPanZoomControls.displayName = "PanZoomControls";

export const PanZoomControls = memo(InnerPanZoomControls);
