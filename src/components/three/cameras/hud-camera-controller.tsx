import type { ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { useCameraSync } from "../../../hooks/use-camera-sync";

export interface HUDCameraControllerProps {
  /** Whether this camera controller is enabled */
  enabled?: boolean;
  /** Specific region this controller should affect */
  regionId?: string;
}

/**
 * Camera controller for HUD cameras.
 *
 * This component manipulates the HUD's own camera based on camera sync state
 * from the player store using frustum manipulation. Each HUD component has its
 * own camera via the `Hud` component, and we manipulate that specific camera instance.
 *
 * Key principles:
 * - Works within the HUD's camera context (not the main scene camera)
 * - Applies horizontal synchronization (zoom and pan.x) with main scene
 * - Uses frustum manipulation (left/right only) for horizontal-only zoom/pan
 * - Keeps vertical frustum stable (HUDs don't follow vertical pan)
 * - Updates projection matrix to apply changes
 *
 * Usage: Place this component inside a `Hud` component to control that HUD's camera.
 */
export function HUDCameraController({
  enabled = true,
  regionId,
}: HUDCameraControllerProps): ReactNode {
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

    // Only apply transformations to regions that support horizontal zoom/pan
    const zoomEnabledRegions = ["TOP_RULER", "TIMELINE", "TRACK_LIST"];
    if (!regionId || !zoomEnabledRegions.includes(regionId)) {
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
