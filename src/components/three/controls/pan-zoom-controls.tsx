import { useEffect, useRef, forwardRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { OrthographicCamera } from "three";
import { usePlayerStore } from "@semio/utils";
import { MotionValue } from "motion";
import { calculatePaddedFrustum } from "../../../viewport-utils";
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
}

export const PanZoomControls = forwardRef<PanZoomControlsImpl, PanZoomControlsProps>(
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
    },
    ref,
  ) => {
    const controlsRef = useRef<PanZoomControlsImpl | null>(null);
    const { camera, gl, invalidate, size } = useThree();

    // Subscribe to player store viewport and update camera with padding
    useEffect(() => {
      const unsub = usePlayerStore.subscribe(
        (state) => state.player.viewport,
        (viewport) => {
          if ((camera as OrthographicCamera).isOrthographicCamera) {
            const { left, right } = calculatePaddedFrustum(
              viewport,
              size.width,
              false, // Dynamic camera follows viewport
            );
            (camera as OrthographicCamera).left = left;
            (camera as OrthographicCamera).right = right;
            camera.updateProjectionMatrix();
          }
        },
      );
      return unsub;
    }, [camera, gl.domElement, size.width]);

    // Initialize camera bounds immediately on mount to prevent HUD timing issues
    useEffect(() => {
      if ((camera as OrthographicCamera).isOrthographicCamera && size.width > 0) {
        const currentViewport = usePlayerStore.getState().player.viewport;
        const { left, right } = calculatePaddedFrustum(
          currentViewport,
          size.width,
          false, // Dynamic camera follows viewport
        );
        (camera as OrthographicCamera).left = left;
        (camera as OrthographicCamera).right = right;
        camera.updateProjectionMatrix();
      }
    }, [camera, size.width]); // Run when camera or canvas size is available

    // Create controls instance only when camera or domElement changes
    // Setup PanZoomControlsImpl and sync viewport changes to player store
    const setPlayerViewport = usePlayerStore((state) => state.updatePlayerViewport);

    useEffect(() => {
      // Wait for camera and canvas to be properly initialized
      if (!(camera instanceof OrthographicCamera) || size.width <= 0) {
        return;
      }

      const controls = new PanZoomControlsImpl(camera, gl.domElement);
      controlsRef.current = controls;

      // Set initial properties
      controls.enabled = enabled;
      controls.enablePan = enablePan;
      controls.enableZoom = enableZoom;
      controls.panSpeed = panSpeed;
      controls.zoomSpeed = zoomSpeed;
      controls.minZoom = minZoom;
      controls.maxZoom = maxZoom;
      controls.bounds = bounds;

      // Add scrollValue, trackRegion, and contentHeightPx to controls instance
      controls.scrollValue = scrollValue;
      controls.trackRegion = trackRegion;
      controls.contentHeightPx = contentHeightPx;

      // Sync viewport changes from controls to player store
      // The controls now pass data viewport (without padding) directly
      controls.onViewportChange = (frustum) => {
        setPlayerViewport(frustum.left, frustum.right);
      };

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
        controlsRef.current = null;
      };
    }, [
      camera,
      gl.domElement,
      size.width, // Wait for proper canvas size
      ref,
      enabled,
      enablePan,
      enableZoom,
      panSpeed,
      zoomSpeed,
      minZoom,
      maxZoom,
      bounds,
      setPlayerViewport,
      scrollValue,
      trackRegion,
      contentHeightPx,
    ]);

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

    // Update properties when they change
    useEffect(() => {
      if (controlsRef.current) {
        controlsRef.current.enabled = enabled;
        controlsRef.current.enablePan = enablePan;
        controlsRef.current.enableZoom = enableZoom;
        controlsRef.current.panSpeed = panSpeed;
        controlsRef.current.zoomSpeed = zoomSpeed;
        controlsRef.current.minZoom = minZoom;
        controlsRef.current.maxZoom = maxZoom;
        controlsRef.current.scrollValue = scrollValue;
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
      scrollValue,
      trackRegion,
      contentHeightPx,
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

PanZoomControls.displayName = "PanZoomControls";
