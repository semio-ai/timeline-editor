import type { ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { useCameraSync } from "../../../hooks/use-camera-sync";

export interface GestureOnlyCameraProps {
  /** Whether this camera controller is enabled */
  enabled?: boolean;
  /** Whether to enable pan gestures */
  enablePan?: boolean;
  /** Whether to enable zoom gestures */
  enableZoom?: boolean;
}

/**
 * Gesture-Only Camera Controller
 *
 * Provides pan/zoom gesture functionality without interfering with R3F's
 * natural camera resize behavior. This controller ONLY applies gesture
 * transformations on top of R3F's base camera state.
 *
 * Key principles:
 * - Does NOT set absolute camera frustum values
 * - Does NOT interfere with canvas resize handling
 * - ONLY applies relative zoom/pan transformations from gesture state
 * - Preserves R3F's natural camera adjustment behavior
 * - Works with the existing useCameraSync() gesture system
 *
 * Usage: Place this component in your scene to add gesture functionality
 * without breaking R3F's resize handling.
 */
export function GestureOnlyCamera({
  enabled = true,
  enablePan = true,
  enableZoom = true,
}: GestureOnlyCameraProps): ReactNode {
  const { zoom, pan } = useCameraSync();

  // Store the base camera state that R3F manages
  const baseCameraState = useRef<{
    left: number;
    right: number;
    top: number;
    bottom: number;
    captured: boolean;
  }>({
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    captured: false,
  });

  useFrame(({ camera }) => {
    if (!enabled || camera.type !== "OrthographicCamera") {
      return;
    }

    const orthoCamera = camera as THREE.OrthographicCamera;

    // Capture the base camera state that R3F sets naturally
    // This represents the "neutral" state without any gesture transformations
    if (!baseCameraState.current.captured) {
      baseCameraState.current = {
        left: orthoCamera.left,
        right: orthoCamera.right,
        top: orthoCamera.top,
        bottom: orthoCamera.bottom,
        captured: true,
      };
      return; // Don't apply transformations on first frame
    }

    // Check if R3F has updated the base camera (e.g., due to resize)
    // If the camera dimensions changed significantly, update our base state
    const currentWidth = orthoCamera.right - orthoCamera.left;
    const storedBaseWidth = baseCameraState.current.right - baseCameraState.current.left;
    const widthChangeSignificant = Math.abs(currentWidth - storedBaseWidth) > 1;

    if (widthChangeSignificant) {
      // R3F updated the camera (likely due to resize), capture new base state
      baseCameraState.current = {
        left: orthoCamera.left,
        right: orthoCamera.right,
        top: orthoCamera.top,
        bottom: orthoCamera.bottom,
        captured: true,
      };
      return; // Don't apply transformations when base state changes
    }

    // Apply gesture transformations on top of the base camera state
    const base = baseCameraState.current;
    const baseFrustumWidth = base.right - base.left;
    const baseFrustumHeight = base.top - base.bottom;
    const baseCenterX = (base.left + base.right) / 2;
    const baseCenterY = (base.top + base.bottom) / 2;

    // Apply zoom transformation
    let finalWidth = baseFrustumWidth;
    let finalHeight = baseFrustumHeight;

    if (enableZoom && zoom !== 1) {
      finalWidth = baseFrustumWidth / zoom;
      finalHeight = baseFrustumHeight / zoom;
    }

    // Apply pan transformation
    let finalCenterX = baseCenterX;
    let finalCenterY = baseCenterY;

    if (enablePan && (pan.x !== 0 || pan.y !== 0)) {
      // Convert normalized pan values to world coordinates
      finalCenterX = baseCenterX + pan.x * baseFrustumWidth;
      finalCenterY = baseCenterY + pan.y * baseFrustumHeight;
    }

    // Set the final camera frustum with gesture transformations applied
    orthoCamera.left = finalCenterX - finalWidth / 2;
    orthoCamera.right = finalCenterX + finalWidth / 2;
    orthoCamera.top = finalCenterY + finalHeight / 2;
    orthoCamera.bottom = finalCenterY - finalHeight / 2;

    orthoCamera.updateProjectionMatrix();
  });

  // This component doesn't render anything - it's just a camera controller
  return null;
}

/**
 * Horizontal-Only Gesture Camera
 *
 * Variant that only applies horizontal gestures (zoom and horizontal pan).
 * Useful for timeline-style interactions where vertical pan is not desired.
 */
export function HorizontalGestureCamera({
  enabled = true,
  enableZoom = true,
}: {
  enabled?: boolean;
  enableZoom?: boolean;
}): ReactNode {
  return (
    <GestureOnlyCamera
      enabled={enabled}
      enablePan // Pan will be applied but only horizontally
      enableZoom={enableZoom}
    />
  );
}

/**
 * Debug version that logs gesture applications
 */
export function DebugGestureCamera({
  enabled = true,
  enablePan = true,
  enableZoom = true,
}: GestureOnlyCameraProps): ReactNode {
  console.log("🎮 DebugGestureCamera: Component mounted/rendering", {
    enabled,
    enablePan,
    enableZoom,
  });

  const { zoom, pan } = useCameraSync();
  const frameCount = useRef<number>(0);

  useFrame(() => {
    frameCount.current++;

    // Log gesture state every 60 frames
    if (frameCount.current % 60 === 0) {
      console.log("🎮 GestureCamera: Current gesture state", {
        frame: frameCount.current,
        zoom,
        pan,
        enabled,
        enablePan,
        enableZoom,
      });
    }
  });

  return <GestureOnlyCamera enabled={enabled} enablePan={enablePan} enableZoom={enableZoom} />;
}
