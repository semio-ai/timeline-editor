import type { ReactNode } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useCameraSync } from "../../../hooks/use-camera-sync";
import { useRegion } from "../layout";
import { DATA_VISUALIZATION_REGIONS } from "../data-visualization-layout-config";

export interface LayoutAwareCameraProps {
  /** Whether this camera controller is enabled */
  enabled?: boolean;
  /** Target region for camera bounds */
  targetRegion?: string;
}

/**
 * Layout-aware camera controller for main scene camera.
 *
 * Manipulates the main scene camera based on camera sync state while respecting
 * the layout system's region bounds. This provides an alternative to frustum-based
 * camera control by directly setting camera properties.
 *
 * Key features:
 * - Direct camera position and zoom manipulation
 * - Region-aware coordinate transformations
 * - Automatic camera bounds adjustment
 * - Cleanup on unmount
 */
export function LayoutAwareCamera({
  enabled = true,
  targetRegion = DATA_VISUALIZATION_REGIONS.TRACK_LIST,
}: LayoutAwareCameraProps): ReactNode {
  const { camera } = useThree();
  const { zoom, pan } = useCameraSync();
  const regionBounds = useRegion(targetRegion);

  // Store initial camera state for cleanup
  const initialState = useRef<{
    position: THREE.Vector3;
    zoom: number;
    left: number;
    right: number;
    top: number;
    bottom: number;
  } | null>(null);

  // Capture initial camera state on first render
  useEffect(() => {
    if (camera.type === "OrthographicCamera" && !initialState.current) {
      const orthoCamera = camera as THREE.OrthographicCamera;
      initialState.current = {
        position: orthoCamera.position.clone(),
        zoom: orthoCamera.zoom,
        left: orthoCamera.left,
        right: orthoCamera.right,
        top: orthoCamera.top,
        bottom: orthoCamera.bottom,
      };
    }
  }, [camera]);

  useFrame(() => {
    if (
      !enabled ||
      !regionBounds ||
      !initialState.current ||
      camera.type !== "OrthographicCamera"
    ) {
      return;
    }

    const orthoCamera = camera as THREE.OrthographicCamera;
    const initial = initialState.current;

    // Apply zoom transformation
    orthoCamera.zoom = initial.zoom * zoom;

    // Convert pan to world coordinates and set camera position
    const worldPanX = pan.x * regionBounds.dimensions.width;
    const worldPanY = pan.y * regionBounds.dimensions.height;

    orthoCamera.position.x = regionBounds.center.x - worldPanX;
    orthoCamera.position.y = regionBounds.center.y - worldPanY;
    orthoCamera.position.z = initial.position.z;

    // Set camera frustum to match region bounds
    const halfWidth = regionBounds.dimensions.width / 2;
    const halfHeight = regionBounds.dimensions.height / 2;

    orthoCamera.left = -halfWidth;
    orthoCamera.right = halfWidth;
    orthoCamera.top = halfHeight;
    orthoCamera.bottom = -halfHeight;

    orthoCamera.updateProjectionMatrix();
  });

  // Restore initial camera state on cleanup
  useEffect(() => {
    return () => {
      if (initialState.current && camera.type === "OrthographicCamera") {
        const orthoCamera = camera as THREE.OrthographicCamera;
        const initial = initialState.current;

        orthoCamera.position.copy(initial.position);
        orthoCamera.zoom = initial.zoom;
        orthoCamera.left = initial.left;
        orthoCamera.right = initial.right;
        orthoCamera.top = initial.top;
        orthoCamera.bottom = initial.bottom;
        orthoCamera.updateProjectionMatrix();
      }
    };
  }, [camera, enabled]);

  return null;
}

/**
 * Content-based synchronization controller.
 *
 * Applies zoom/pan transformations to content instead of manipulating the camera.
 * Use this when you want sync effects while preserving the layout system's camera setup.
 */
export function LayoutAwareContentController({
  enabled = true,
  targetRegion = DATA_VISUALIZATION_REGIONS.TRACK_LIST,
  children,
}: LayoutAwareCameraProps & { children: ReactNode }): ReactNode {
  const { zoom, pan } = useCameraSync();
  const regionBounds = useRegion(targetRegion);

  if (!enabled || !regionBounds) {
    return <>{children}</>;
  }

  // Convert pan to world coordinates for content positioning
  const worldPanX = pan.x * regionBounds.dimensions.width;
  const worldPanY = pan.y * regionBounds.dimensions.height;

  return (
    <group scale={[zoom, zoom, 1]} position={[-worldPanX, -worldPanY, 0]}>
      {children}
    </group>
  );
}

/**
 * HUD content synchronizer for horizontal-only sync.
 *
 * Applies horizontal zoom/pan transformations to HUD content while ignoring
 * vertical transformations. Keeps HUD elements synchronized with main scene.
 */
export function HUDContentSynchronizer({
  enabled = true,
  children,
}: {
  enabled?: boolean;
  children: ReactNode;
}): ReactNode {
  const { zoom, pan } = useCameraSync();

  if (!enabled) {
    return <>{children}</>;
  }

  // Apply horizontal-only synchronization for HUD elements
  const baseWidth = 800; // Standard timeline width for HUD sync calculations

  return (
    <group scale={[zoom, 1, 1]} position={[-pan.x * baseWidth, 0, 0]}>
      {children}
    </group>
  );
}
