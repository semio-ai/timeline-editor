import { useEffect, useRef, forwardRef, memo } from "react";
import { useThree } from "@react-three/fiber";
import { OrthographicCamera, Vector2 } from "three";
import { usePlayerStore, isOrthographicCamera } from "@semio/utils";
import { useShallow } from "zustand/shallow";
import { useGesture } from "@use-gesture/react";
import {
  calculatePaddedFrustum,
  getDataViewportFromFrustum,
  setFrustumFromDataViewport,
} from "../../viewport-utils";
import { TrackRender } from "../../types";
import { useAnimationStore } from "../../hooks";

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
    },
    ref,
  ) => {
    const { camera, gl, size } = useThree();
    const scrollOffset = useAnimationStore(useShallow((state) => state.scrollOffset));
    const setScrollOffset = useAnimationStore(useShallow((state) => state.setScrollOffset));
    const scrollRef = useRef({ offset: scrollOffset, set: setScrollOffset });
    scrollRef.current = { offset: scrollOffset, set: setScrollOffset };
    const initialCameraWidth = useRef(0);
    const initialCameraHeight = useRef(0);
    const viewport = usePlayerStore(
      useShallow((state) => state.player.viewport as [number, number]),
    );
    const updatePlayerViewport = usePlayerStore((state) => state.updatePlayerViewport);
    const viewportRef = useRef<[number, number]>(viewport);

    useEffect(() => {
      viewportRef.current = viewport;
    }, [viewport]);

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

    // Setup player store integration
    useEffect(() => {
      if (!(camera instanceof OrthographicCamera) || size.width <= 0) {
        return;
      }

      const applyViewport = (vp: [number, number]) => {
        const { left, right } = calculatePaddedFrustum(vp, size.width, false);
        camera.left = left;
        camera.right = right;
        camera.updateProjectionMatrix();
        // Only set initial width once — it anchors the zoom min/max range
        if (initialCameraWidth.current <= 0) {
          initialCameraWidth.current = vp[1] - vp[0];
        }
        // Capture initial camera height for vertical zoom limits
        if (initialCameraHeight.current <= 0) {
          initialCameraHeight.current = camera.top - camera.bottom;
        }
      };

      // Subscribe to player store viewport changes
      const unsubscribe = usePlayerStore.subscribe(
        (state) => state.player.viewport,
        (vp) => {
          if (size.width > 0) {
            viewportRef.current = vp;
            applyViewport(vp);
          }
        },
      );

      // Initialize camera bounds
      applyViewport(viewportRef.current);

      return unsubscribe;
    }, [camera, size.width]);

    // Pan camera function
    const panCamera = (deltaX: number) => {
      if (!(camera instanceof OrthographicCamera) || !settingsRef.current.enablePan) return;

      const canvasWidth = gl.domElement?.clientWidth || 1;
      const currentDataViewport = getDataViewportFromFrustum(
        { left: camera.left, right: camera.right },
        canvasWidth,
      );

      const dataWidth = currentDataViewport.right - currentDataViewport.left;
      // Convert pixel delta to world units: each pixel of scroll moves by
      // (dataWidth / canvasWidth) world units, scaled by panSpeed.
      const adjustedDeltaX = (deltaX / canvasWidth) * dataWidth * settingsRef.current.panSpeed;

      let newDataLeft = currentDataViewport.left + adjustedDeltaX;
      let newDataRight = currentDataViewport.right + adjustedDeltaX;

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

      // Update camera
      const newFrustum = setFrustumFromDataViewport(
        { left: newDataLeft, right: newDataRight },
        canvasWidth,
      );

      camera.left = newFrustum.left;
      camera.right = newFrustum.right;
      camera.updateProjectionMatrix();

      // Notify player store
      updatePlayerViewport(newDataLeft, newDataRight);
    };

    // Zoom camera function
    const zoomCameraHorizontal = (zoomFactor: number, center: Vector2) => {
      if (
        !(camera instanceof OrthographicCamera) ||
        !settingsRef.current.enableZoom ||
        !gl.domElement
      )
        return;

      const canvasWidth = gl.domElement.clientWidth;
      const rect = gl.domElement.getBoundingClientRect();

      const currentDataViewport = getDataViewportFromFrustum(
        { left: camera.left, right: camera.right },
        canvasWidth,
      );

      const currentDataWidth = currentDataViewport.right - currentDataViewport.left;
      const minDataWidth = initialCameraWidth.current / settingsRef.current.maxZoom;
      const maxDataWidth = initialCameraWidth.current / settingsRef.current.minZoom;
      const newDataWidth = Math.max(
        minDataWidth,
        Math.min(maxDataWidth, currentDataWidth / zoomFactor),
      );

      if (Math.abs(newDataWidth - currentDataWidth) < 0.000001) return;

      // Calculate zoom center in data space
      const relativeX = (center.x - rect.left) / rect.width;
      const targetDataX = currentDataViewport.left + currentDataWidth * relativeX;
      const newDataCenterX = targetDataX - newDataWidth * (relativeX - 0.5);

      let newDataLeft = newDataCenterX - newDataWidth / 2;
      let newDataRight = newDataCenterX + newDataWidth / 2;

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

      // Update camera
      const newFrustum = setFrustumFromDataViewport(
        { left: newDataLeft, right: newDataRight },
        canvasWidth,
      );

      camera.left = newFrustum.left;
      camera.right = newFrustum.right;
      camera.updateProjectionMatrix();

      // Notify player store
      updatePlayerViewport(newDataLeft, newDataRight);
    };

    // Zoom camera vertically around a pointer position (spline mode only)
    const zoomCameraVertical = (zoomFactor: number, clientY: number) => {
      if (!(camera instanceof OrthographicCamera) || !gl.domElement) return;
      const rect = gl.domElement.getBoundingClientRect();
      const relativeY = (clientY - rect.top) / rect.height;
      const frustumHeight = camera.top - camera.bottom;
      const targetY = camera.top - relativeY * frustumHeight;
      const newHeight = frustumHeight / zoomFactor;
      camera.top = targetY + newHeight * relativeY;
      camera.bottom = targetY - newHeight * (1 - relativeY);
      camera.updateProjectionMatrix();
    };

    // Handle vertical scrolling in track region
    const handleTrackScroll = (event: { deltaY: number; clientY: number }) => {
      const {
        trackRegion: trackReg,
        contentHeightPx: contentHeight,
      } = settingsRef.current;
      const rect = gl.domElement?.getBoundingClientRect();

      if (!trackReg || typeof contentHeight !== "number" || !rect) {
        return false;
      }

      const pointerY = event.clientY - rect.top;
      const { top = 0, bottom = 0 } = trackReg;
      const trackRegionStart = top;
      const trackRegionEnd = rect.height - bottom;

      if (pointerY >= trackRegionStart && pointerY <= trackRegionEnd) {
        const visibleHeightPx = rect.height - top - bottom;
        const scrollMin = 0;
        const scrollMax = Math.max(0, contentHeight - visibleHeightPx);

        if (scrollMax === 0) return true; // Handled but no scroll needed

        const prev = scrollRef.current.offset;
        let next = prev + event.deltaY;
        next = Math.max(scrollMin, Math.min(scrollMax, next));
        scrollRef.current.set(next);

        return true; // Event was handled
      }

      return false;
    };

    // Compute the effective zoom factor for horizontal axis after clamping
    const effectiveHorizontalFactor = (requestedFactor: number): number => {
      if (!(camera instanceof OrthographicCamera) || !gl.domElement) return requestedFactor;
      const canvasWidth = gl.domElement.clientWidth;
      const currentDataViewport = getDataViewportFromFrustum(
        { left: camera.left, right: camera.right },
        canvasWidth,
      );
      const currentDataWidth = currentDataViewport.right - currentDataViewport.left;
      if (initialCameraWidth.current <= 0 || currentDataWidth <= 0) return requestedFactor;
      const minDataWidth = initialCameraWidth.current / settingsRef.current.maxZoom;
      const maxDataWidth = initialCameraWidth.current / settingsRef.current.minZoom;
      const newDataWidth = Math.max(minDataWidth, Math.min(maxDataWidth, currentDataWidth / requestedFactor));
      return currentDataWidth / newDataWidth;
    };

    // Compute the effective zoom factor for vertical axis after clamping
    const effectiveVerticalFactor = (requestedFactor: number): number => {
      if (!(camera instanceof OrthographicCamera)) return requestedFactor;
      const currentHeight = camera.top - camera.bottom;
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
          // Vertical scroll/pan (track list in non-spline, camera Y pan in spline)
          if (!hasCtrl && !shiftKey && isVerticalDominant) {
            if (isSpline) {
              if (isOrthographicCamera(camera)) {
                const frustumHeight = camera.top - camera.bottom;
                const worldDeltaY = (deltaY / size.height) * frustumHeight;
                camera.top -= worldDeltaY;
                camera.bottom -= worldDeltaY;
                camera.updateProjectionMatrix();
              }
            } else {
              handleTrackScroll({ deltaY, clientY: event.clientY });
            }
            event.preventDefault();
            onChange?.();
            onEnd?.();
            return;
          }

          // --- Scroll + Shift: Horizontal pan ---
          if (!hasCtrl && shiftKey && isVerticalDominant) {
            if (settingsRef.current.enablePan) {
              panCamera(deltaY);
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
            } else if (isSpline && isOrthographicCamera(camera)) {
              // Ctrl + Scroll (no Shift): Vertical zoom (spline only)
              const effV = effectiveVerticalFactor(zoomFactor);
              if (Math.abs(effV - 1) > 0.0001) {
                zoomCameraVertical(effV, event.clientY);
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

          if (first) {
            onStart?.();
          }

          event.preventDefault();

          const isSpline = settingsRef.current.trackRender === TrackRender.Spline;
          const scaleFactor = 1 + (scale - 1) * settingsRef.current.zoomSpeed * 0.5;

          // Read modifier keys from the native event
          const nativeEvent = event as TouchEvent & { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean };
          const hasCtrl = nativeEvent.ctrlKey || nativeEvent.metaKey;
          const hasShift = nativeEvent.shiftKey;

          // Determine zoom axis:
          // 1. Modifier keys override (Ctrl/Cmd+Pinch → vertical, Shift+Pinch → horizontal)
          // 2. Touch finger angle (if available)
          // 3. Default: uniform
          let zoomAxis: "horizontal" | "vertical" | "uniform" = "uniform";

          if (isSpline && hasCtrl && !hasShift) {
            zoomAxis = "vertical";
          } else if (hasShift && !hasCtrl) {
            zoomAxis = "horizontal";
          } else {
            const touches = nativeEvent?.touches;
            if (touches?.length === 2) {
              // Touch device: finger angle determines axis
              const dx = Math.abs(touches[1].clientX - touches[0].clientX);
              const dy = Math.abs(touches[1].clientY - touches[0].clientY);
              zoomAxis = dx > dy ? "horizontal" : "vertical";
            }
          }

          // Non-spline: no vertical axis, force horizontal
          if (!isSpline && zoomAxis === "vertical") {
            zoomAxis = "horizontal";
          }
          if (!isSpline && zoomAxis === "uniform") {
            zoomAxis = "horizontal";
          }

          // Apply zoom to the determined axis/axes
          if (zoomAxis === "uniform" && isSpline && isOrthographicCamera(camera)) {
            // For uniform zoom, clamp to the more restrictive axis so they stay in sync
            const effH = effectiveHorizontalFactor(scaleFactor);
            const effV = effectiveVerticalFactor(scaleFactor);
            // Use the factor closer to 1 (less zoom) so neither axis exceeds its limit
            const uniformFactor = Math.abs(effH - 1) < Math.abs(effV - 1) ? effH : effV;

            if (Math.abs(uniformFactor - 1) > 0.0001) {
              const center = new Vector2(origin[0], origin[1]);
              zoomCameraHorizontal(uniformFactor, center);
              zoomCameraVertical(uniformFactor, origin[1]);
            }
          } else if (zoomAxis === "horizontal" || (zoomAxis === "uniform" && !isSpline)) {
            const center = new Vector2(origin[0], origin[1]);
            zoomCameraHorizontal(scaleFactor, center);
          } else if (zoomAxis === "vertical" && isSpline && isOrthographicCamera(camera)) {
            const effV = effectiveVerticalFactor(scaleFactor);
            if (Math.abs(effV - 1) > 0.0001) {
              zoomCameraVertical(effV, origin[1]);
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
