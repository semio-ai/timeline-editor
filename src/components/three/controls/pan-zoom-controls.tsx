import { useEffect, useRef, forwardRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { OrthographicCamera } from "three";
import { usePlayerStore } from "@semio/utils";
// import { useCameraSync } from "../../../hooks";
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
}

export const PanZoomControls = forwardRef<PanZoomControlsImpl, PanZoomControlsProps>(
  (
    {
      enabled = true,
      enablePan = true,
      enableZoom = true,
      panSpeed = 1.0,
      zoomSpeed = 1.0,
      minZoom = 0.1,
      maxZoom = 10,
      onChange,
      onStart,
      onEnd,
      bounds,
    },
    ref,
  ) => {
    const controlsRef = useRef<PanZoomControlsImpl | null>(null);
    const { camera, gl, invalidate } = useThree();

    // Subscribe to player store viewport and update camera directly
    useEffect(() => {
      const unsub = usePlayerStore.subscribe(
        (state) => state.player.viewport,
        (viewport) => {
          if ((camera as OrthographicCamera).isOrthographicCamera) {
            (camera as OrthographicCamera).left = viewport[0];
            (camera as OrthographicCamera).right = viewport[1];
            camera.updateProjectionMatrix();
          }
        },
      );
      return unsub;
    }, [camera]);

    // Create controls instance only when camera or domElement changes
    // Setup PanZoomControlsImpl and sync viewport changes to player store
    const setPlayerViewport = usePlayerStore((state) => state.updatePlayerViewport);

    useEffect(() => {
      if (!(camera instanceof OrthographicCamera)) {
        console.warn("PanZoomControls: camera must be an OrthographicCamera");
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

      // Sync viewport changes from controls to player store
      controls.onViewportChange = (frustum) => {
        // Assuming bounds are [0, 1], map left/right directly
        setPlayerViewport(frustum.left, frustum.right);
      };

      controlsRef.current = controls;
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
      }
    }, [enabled, enablePan, enableZoom, panSpeed, zoomSpeed, minZoom, maxZoom]);

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
