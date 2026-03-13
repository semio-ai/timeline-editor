import { useEffect, useRef, forwardRef, memo } from "react";
import { useThree } from "@react-three/fiber";
import { OrthographicCamera, Vector2 } from "three";
import { usePlayerStore } from "@semio/utils";
import { useShallow } from "zustand/shallow";
import { MotionValue } from "motion";
import { useGesture } from "@use-gesture/react";
import {
  calculatePaddedFrustum,
  getDataViewportFromFrustum,
  setFrustumFromDataViewport,
} from "../../viewport-utils";
import { TrackRender } from "../../types";

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
  scrollValue?: MotionValue<number>;
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
  scrollValue?: MotionValue<number>;
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
      scrollValue,
      trackRegion,
      contentHeightPx,
      trackRender,
    },
    ref,
  ) => {
    const { camera, gl, size } = useThree();
    const initialCameraWidth = useRef(1.0);
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
      scrollValue,
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
        scrollValue,
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
      scrollValue,
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
        initialCameraWidth.current = vp[1] - vp[0];
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
      const scale = (dataWidth / initialCameraWidth.current) * 0.25;
      const adjustedDeltaX = deltaX * scale * settingsRef.current.panSpeed;

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

    // Handle vertical scrolling in track region
    const handleTrackScroll = (event: { deltaY: number; clientY: number }) => {
      const {
        scrollValue: scrollVal,
        trackRegion: trackReg,
        contentHeightPx: contentHeight,
      } = settingsRef.current;
      const rect = gl.domElement?.getBoundingClientRect();

      if (!scrollVal || !trackReg || typeof contentHeight !== "number" || !rect) {
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

        const prev = scrollVal.get();
        let next = prev + event.deltaY;
        next = Math.max(scrollMin, Math.min(scrollMax, next));
        scrollVal.set(next);

        return true; // Event was handled
      }

      return false;
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

          // Check for vertical scroll in track region (no modifier keys)
          if (!ctrlKey && !metaKey && !shiftKey && absDeltaY > absDeltaX && absDeltaY > threshold) {
            if (settingsRef.current.trackRender !== TrackRender.Spline) {
              const handled = handleTrackScroll({
                deltaY,
                clientY: event.clientY,
              });

              if (handled) {
                event.preventDefault();
                onChange?.();
                onEnd?.();
                return;
              }
            }
          }

          event.preventDefault();

          // Zoom: Ctrl/Cmd + vertical scroll
          if ((ctrlKey || metaKey) && absDeltaY > absDeltaX && absDeltaY > threshold) {
            if (settingsRef.current.enableZoom) {
              const baseZoomFactor = deltaY > 0 ? 0.9 : 1.1;
              const zoomFactor = 1 + (baseZoomFactor - 1) * settingsRef.current.zoomSpeed;
              const center = new Vector2(event.clientX, event.clientY);
              zoomCameraHorizontal(zoomFactor, center);
            }
          }
          // Pan: Shift + vertical scroll (converts to horizontal pan)
          else if (
            shiftKey &&
            !ctrlKey &&
            !metaKey &&
            settingsRef.current.enablePan &&
            absDeltaY > absDeltaX &&
            absDeltaY > threshold
          ) {
            // Convert vertical scroll to horizontal pan with zoom-adjusted speed
            const panDelta = deltaY * settingsRef.current.panSpeed * 0.1;
            panCamera(panDelta);
          }
          // Pan: horizontal scroll
          else if (
            settingsRef.current.enablePan &&
            absDeltaX > absDeltaY &&
            absDeltaX > threshold
          ) {
            const panDelta = deltaX * settingsRef.current.panSpeed * 0.1;
            panCamera(panDelta);
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

          // Use offset with proper scaling - scale is ratio from initial pinch distance
          const scaleFactor = 1 + (scale - 1) * settingsRef.current.zoomSpeed * 0.5;
          const center = new Vector2(origin[0], origin[1]);
          zoomCameraHorizontal(scaleFactor, center);

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
          scrollValue: settingsRef.current.scrollValue,
          trackRegion: settingsRef.current.trackRegion,
          contentHeightPx: settingsRef.current.contentHeightPx,
          getFrustum: () => ({
            left: (camera as OrthographicCamera).left,
            right: (camera as OrthographicCamera).right,
            top: (camera as OrthographicCamera).top,
            bottom: (camera as OrthographicCamera).bottom,
          }),
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
