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
import { useControlKeyHeld } from "../../hooks/use-control-key-held";
import {
  ZoomAxis,
  ZoomWheelInput,
  classifyZoomWheel,
  fingerSpreadAxis,
  isLikelyMouseWheel,
  pinchStepFactor,
  wheelDeltaPx,
  wheelZoomFactor,
} from "../../functions/wheel-input";

/** What a pinch gesture carries from one update to the next, in use-gesture's `memo`. */
interface PinchMemo {
  /** The gesture's cumulative scale as of this update. */
  scale: number;
  /** Whether `onStart` has fired for this gesture. */
  started: boolean;
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
    const controlKeyHeld = useControlKeyHeld();

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

    // Zoom `axis` by `factor` about the given client point. Only Spline mode has a
    // value axis, so every zoom in any other mode zooms time. Zooming both axes
    // clamps to the more restrictive one so they stay in step at the zoom limits.
    // Only an unchanged factor is skipped: continuous input arrives in steps small
    // enough that any cutoff would drop a slow gesture that a fast one applies.
    const applyZoom = (factor: number, clientX: number, clientY: number, axis: ZoomAxis) => {
      if (factor === 1) return;
      const mode = settingsRef.current.trackRender ?? TrackRender.Key;
      const effectiveAxis = mode === TrackRender.Spline ? axis : ZoomAxis.Time;
      if (effectiveAxis === ZoomAxis.Time) {
        zoomCameraHorizontal(factor, new Vector2(clientX, clientY));
        return;
      }
      const rect = gl.domElement?.getBoundingClientRect();
      if (!rect) return;
      const effV = effectiveVerticalFactor(factor);
      if (effectiveAxis === ZoomAxis.Value) {
        if (effV !== 1) {
          zoomVertical(effV, clientY, { mode, canvasRect: rect });
        }
        return;
      }
      const effH = effectiveHorizontalFactor(factor);
      const uniformFactor = Math.abs(effH - 1) < Math.abs(effV - 1) ? effH : effV;
      if (uniformFactor === 1) return;
      zoomCameraHorizontal(uniformFactor, new Vector2(clientX, clientY));
      zoomVertical(uniformFactor, clientY, { mode, canvasRect: rect });
    };

    // Setup gesture handlers. Every wheel event, including a trackpad pinch that
    // Chromium delivers as a ctrlKey wheel, is handled by `onWheel` alone: the
    // pinch handler is not bound to wheel events (`pinchOnWheel: false`), so no
    // wheel event zooms twice. `onPinch` handles Safari's gesture events and
    // touchscreens.
    useGesture(
      {
        onWheel: ({ event, last, ctrlKey, metaKey, shiftKey }) => {
          // use-gesture reports a wheel gesture's end ~140ms after its last event,
          // with that event still attached. It carries no new input, and reading
          // its delta again would apply the last event twice.
          if (last) return;
          // A ctrlKey wheel is the browser's page-zoom gesture, and how Chromium
          // delivers a trackpad pinch. Keep the page from zooming even when the
          // checks below leave the event unhandled.
          if (ctrlKey && event.cancelable) event.preventDefault();
          if (!settingsRef.current.enabled) return;
          // Block gestures while an interactive overlay (context menu, popover) is open
          if (useTooltipStore.getState().hasInteractiveOverlay()) return;

          // The event's own delta, not use-gesture's `delta`: that one is the
          // difference of two offsets accumulated over every wheel event the canvas
          // has seen, so after any fractional (trackpad) delta an integer notch comes
          // back non-integer and `isLikelyMouseWheel` misreads it.
          const [deltaX, deltaY] = wheelDeltaPx(event as WheelEvent);
          const absDeltaX = Math.abs(deltaX);
          const absDeltaY = Math.abs(deltaY);
          const threshold = 0.5;

          onStart?.();

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

          // --- Ctrl/Cmd + wheel, and trackpad pinch: Zoom ---
          // The zoom rate follows the input (see `wheelZoomFactor`): a mouse notch
          // zooms at the notch rate, continuous input at the pinch rate, both in
          // proportion to the delta, so a pinch tracks the fingers and needs no dead
          // zone. A pinch (a ctrlKey wheel with Control not actually held) zooms
          // like a gesture pinch, both axes in spline mode; a modifier-held wheel
          // zooms the value axis in spline mode, or time with Shift added.
          if (hasCtrl && settingsRef.current.enableZoom) {
            const dominantDelta = absDeltaY >= absDeltaX ? deltaY : deltaX;
            const wheelEvent = event as WheelEvent;
            const input = classifyZoomWheel(wheelEvent, dominantDelta, controlKeyHeld.current);
            const zoomFactor = wheelZoomFactor(
              dominantDelta,
              input,
              settingsRef.current.zoomSpeed,
              wheelEvent.deltaMode,
            );
            let axis = ZoomAxis.Time;
            if (input === ZoomWheelInput.Pinch) {
              axis = ZoomAxis.Both;
            } else if (!shiftKey) {
              axis = ZoomAxis.Value;
            }
            applyZoom(zoomFactor, event.clientX, event.clientY, axis);
          }

          onChange?.();
          onEnd?.();
        },
        onPinch: ({
          origin,
          last,
          intentional,
          offset: [scale],
          da: [, fingerAngle],
          event,
          memo: gestureMemo,
        }) => {
          // `scale` is cumulative since the gesture began (`from` starts every
          // gesture at 1), so each update zooms by its ratio to the previous one.
          // The previous scale, and whether `onStart` has fired, live in the
          // gesture's `memo`, which use-gesture clears when a gesture starts.
          // `first` and `last` cannot carry them: use-gesture recomputes those only
          // on an update past the threshold (`intentional`), and `triggerAllEvents`
          // also delivers the updates below it, a gesture's start included, still
          // holding the previous gesture's `first: false, last: true`. Every path
          // returns the memo, so an update skipped below is never applied later.
          const previous = gestureMemo as PinchMemo | undefined;
          const previousScale = previous?.scale ?? 1;
          let started = previous?.started ?? false;
          const blocked =
            !settingsRef.current.enabled ||
            !settingsRef.current.enableZoom ||
            useTooltipStore.getState().hasInteractiveOverlay();

          if (!blocked) {
            event.preventDefault();
            // Below the threshold `scale` is still 1, so there is nothing to zoom.
            if (intentional) {
              if (!started) {
                started = true;
                onStart?.();
              }
              // Axis selection is gesture-only, because pinch+modifier combinations
              // don't round-trip reliably across platforms. Fingers on a touchscreen
              // (use-gesture's touch and pointer devices) zoom the axis they are
              // spread along; Safari's trackpad gesture events carry a rotation in
              // `da` rather than a finger angle, and zoom both axes. Outside Spline
              // mode every zoom is a time zoom.
              const fromFingers = /^(touch|pointer|lostpointercapture)/.test(event.type);
              const axis = fromFingers ? fingerSpreadAxis(fingerAngle) : ZoomAxis.Both;
              applyZoom(
                pinchStepFactor(previousScale, scale, settingsRef.current.zoomSpeed),
                origin[0],
                origin[1],
                axis,
              );
              onChange?.();
            }
          }

          // `started` is set only on an update past the threshold, and from then on
          // use-gesture keeps `last` current, so a stale `last` never reaches here.
          if (last && started) {
            onEnd?.();
          }
          const next: PinchMemo = { scale, started };
          return next;
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
          pinchOnWheel: false,
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
