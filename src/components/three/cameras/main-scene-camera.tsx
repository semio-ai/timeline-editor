import type { ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { useCameraSync } from "../../../hooks/use-camera-sync";

export interface MainSceneCameraControllerProps {
  /** Whether this camera controller is enabled */
  enabled?: boolean;
  /** Specific region this controller should affect */
  regionId?: string;
}

/**
 * Camera controller for the main scene camera.
 *
 * This component manipulates the main Three.js camera based on camera sync state
 * from the player store using frustum manipulation. It provides zoom and pan
 * functionality for the primary track content area.
 *
 * Key principles:
 * - Works with the existing camera, doesn't replace it
 * - Applies horizontal synchronization (zoom and pan.x) with HUD elements
 * - Uses frustum manipulation (left/right only) for horizontal-only zoom/pan
 * - Preserves vertical frustum bounds (top/bottom unchanged)
 * - Updates projection matrix to apply changes
 *
 * Usage: Place this component in the main scene to control the default camera.
 */
export function MainSceneCameraController({
  enabled = true,
  regionId = "TRACK_LIST",
}: MainSceneCameraControllerProps): ReactNode {
  const { viewport } = useCameraSync();
  const initialFrustum = useRef<{
    left: number;
    right: number;
    top: number;
    bottom: number;
    width: number;
  } | null>(null);

  useFrame(({ camera }) => {
    if (!enabled || camera.type !== "OrthographicCamera") {
      return;
    }

    // Only apply transformations to the main track region
    if (regionId !== "TRACK_LIST") {
      return;
    }

    const orthoCamera = camera as THREE.OrthographicCamera;

    // Capture initial frustum dimensions on first frame
    if (!initialFrustum.current) {
      const { left, right, top, bottom } = orthoCamera;
      initialFrustum.current = {
        left,
        right,
        top,
        bottom,
        width: right - left,
      };
    }

    const initial = initialFrustum.current;

    // Calculate viewport dimensions and center
    const viewportWidth = viewport[1] - viewport[0];
    const viewportCenter = (viewport[0] + viewport[1]) / 2;

    // Map viewport to frustum coordinates
    const frustumWidth = initial.width * viewportWidth;
    const frustumCenter = initial.left + viewportCenter * initial.width;

    // Apply horizontal synchronization while preserving vertical bounds
    const halfWidth = frustumWidth / 2;
    orthoCamera.left = frustumCenter - halfWidth;
    orthoCamera.right = frustumCenter + halfWidth;
    orthoCamera.top = initial.top;
    orthoCamera.bottom = initial.bottom;

    orthoCamera.updateProjectionMatrix();
  });

  // This component doesn't render anything - it's just a camera controller
  return null;
}
