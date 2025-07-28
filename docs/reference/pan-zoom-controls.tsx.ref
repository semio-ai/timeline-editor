import { useEffect, useRef, forwardRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { OrthographicCamera } from "three";
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
}

export const PanZoomControls = forwardRef<
  PanZoomControlsImpl,
  PanZoomControlsProps
>(
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
    },
    ref,
  ) => {
    const controlsRef = useRef<PanZoomControlsImpl | null>(null);
    const { camera, gl, invalidate } = useThree();

    // Create controls instance only when camera or domElement changes
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
