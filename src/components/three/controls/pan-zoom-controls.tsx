import { useEffect, useRef, forwardRef, memo } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { OrthographicCamera } from "three";
import { usePlayerStore } from "@semio/utils";
import { MotionValue } from "motion";
import { calculatePaddedFrustum } from "../../../viewport-utils";
import { TrackRender } from "../../../types";
import { PanZoomControls as PanZoomControlsImpl } from "./pan-zoom-controls-impl";

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

const InnerPanZoomControls = forwardRef<PanZoomControlsImpl, PanZoomControlsProps>(
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
    const controlsRef = useRef<PanZoomControlsImpl | null>(null);
    const unsubscribeRef = useRef<(() => void) | null>(null);
    const { camera, gl, invalidate, size } = useThree();

    // Create controls instance only when camera or domElement changes (not on resize)
    useEffect(() => {
      // Only require camera to be OrthographicCamera, don't wait for size
      if (!(camera instanceof OrthographicCamera)) {
        return;
      }

      const controls = new PanZoomControlsImpl(camera, gl.domElement);
      controlsRef.current = controls;

      // Set up player store subscription inside controls creation
      // This ensures viewport updates are properly synchronized
      const setPlayerViewport = usePlayerStore.getState().updatePlayerViewport;

      // Subscribe to player store viewport and update camera with padding
      const unsubscribe = usePlayerStore.subscribe(
        (state) => state.player.viewport,
        (viewport) => {
          // Only update if we have a proper canvas width to prevent flashing
          if (size.width > 0) {
            const { left, right } = calculatePaddedFrustum(
              viewport,
              size.width,
              false, // Dynamic camera follows viewport
            );
            camera.left = left;
            camera.right = right;
            camera.updateProjectionMatrix();
          }
        },
      );

      // Initialize camera bounds immediately if canvas is ready
      if (size.width > 0) {
        const currentViewport = usePlayerStore.getState().player.viewport;
        const { left, right } = calculatePaddedFrustum(currentViewport, size.width, false);
        camera.left = left;
        camera.right = right;
        camera.updateProjectionMatrix();
      }

      // Sync viewport changes from controls to player store
      controls.onViewportChange = (frustum) => {
        setPlayerViewport(frustum.left, frustum.right);
      };

      // Store unsubscribe function
      unsubscribeRef.current = unsubscribe;

      // Expose ref
      if (ref) {
        if (typeof ref === "function") {
          ref(controls);
        } else {
          ref.current = controls;
        }
      }

      return () => {
        controls.dispose();
        unsubscribe();
        controlsRef.current = null;
        unsubscribeRef.current = null;
      };
    }, [camera, gl.domElement, ref, size.width]);

    // Handle canvas size changes without recreating controls
    useEffect(() => {
      if (controlsRef.current && size.width > 0) {
        // Update camera bounds when canvas size changes
        const currentViewport = usePlayerStore.getState().player.viewport;
        const { left, right } = calculatePaddedFrustum(currentViewport, size.width, false);
        (camera as OrthographicCamera).left = left;
        (camera as OrthographicCamera).right = right;
        camera.updateProjectionMatrix();
      }
    }, [camera, size.width]);

    // Update event listeners when callbacks change
    useEffect(() => {
      const controls = controlsRef.current;
      if (!controls) return;

      const handleChange = () => {
        invalidate();
        onChange?.();
      };

      const handleStart = () => {
        onStart?.();
      };

      const handleEnd = () => {
        onEnd?.();
      };

      controls.addEventListener("change", handleChange);
      controls.addEventListener("start", handleStart);
      controls.addEventListener("end", handleEnd);

      return () => {
        controls.removeEventListener("change", handleChange);
        controls.removeEventListener("start", handleStart);
        controls.removeEventListener("end", handleEnd);
      };
    }, [onChange, onStart, onEnd, invalidate]);

    // Update properties when they change (but avoid recreating controls)
    useEffect(() => {
      if (controlsRef.current) {
        controlsRef.current.enabled = enabled;
        controlsRef.current.enablePan = enablePan;
        controlsRef.current.enableZoom = enableZoom;
        controlsRef.current.panSpeed = panSpeed;
        controlsRef.current.zoomSpeed = zoomSpeed;
        controlsRef.current.minZoom = minZoom;
        controlsRef.current.maxZoom = maxZoom;
        controlsRef.current.bounds = bounds;
        // In spline mode, don't pass scrollValue to prevent interference with external scroll
        controlsRef.current.scrollValue =
          trackRender === TrackRender.Spline ? undefined : scrollValue;
        controlsRef.current.trackRegion = trackRegion;
        controlsRef.current.contentHeightPx = contentHeightPx;
      }
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

    // Call update if needed (though our PanZoomControls.update() returns false)
    useFrame(() => {
      if (controlsRef.current?.update) {
        controlsRef.current.update();
      }
    });

    return null;
  },
);

InnerPanZoomControls.displayName = "PanZoomControls";

export const PanZoomControls = memo(InnerPanZoomControls);
