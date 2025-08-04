import type { ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useCameraSync } from "../../../hooks/use-camera-sync";
import type { RegionBounds } from "../layout/types";

export interface TrackCameraProps {
  /** Region bounds for the track area */
  bounds: RegionBounds;
  /** Whether this camera is active */
  enabled?: boolean;
}

/**
 * Camera controller for the main track region.
 *
 * This component manipulates the main scene camera for track content using
 * direct position and zoom transformations. Unlike frustum-based controllers,
 * this approach directly sets camera position and zoom properties.
 *
 * Key principles:
 * - Sets camera zoom directly from sync state
 * - Positions camera based on horizontal pan offset
 * - Maintains vertical centering on region
 * - Updates camera bounds to match region dimensions
 *
 * Usage: Place this component in the main scene for track area camera control.
 */
export function TrackCamera({ bounds, enabled = true }: TrackCameraProps): ReactNode {
  const { zoom, pan } = useCameraSync();

  useFrame(({ camera }) => {
    if (!enabled || camera.type !== "OrthographicCamera") {
      return;
    }

    const orthoCamera = camera as THREE.OrthographicCamera;

    // Apply zoom directly to camera
    orthoCamera.zoom = zoom;

    // Convert pan offset to world coordinates and position camera
    const worldPanX = pan.x * bounds.dimensions.width;
    orthoCamera.position.x = bounds.center.x - worldPanX;
    orthoCamera.position.y = bounds.center.y; // Keep vertically centered

    // Set camera frustum to match region dimensions
    const halfWidth = bounds.dimensions.width / 2;
    const halfHeight = bounds.dimensions.height / 2;

    orthoCamera.left = -halfWidth;
    orthoCamera.right = halfWidth;
    orthoCamera.top = halfHeight;
    orthoCamera.bottom = -halfHeight;

    orthoCamera.updateProjectionMatrix();
  });

  // This component doesn't render anything - it's just a camera controller
  return null;
}
