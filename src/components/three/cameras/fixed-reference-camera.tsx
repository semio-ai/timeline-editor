import type { ReactNode } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useRef, useEffect } from "react";
import * as THREE from "three";

export interface FixedReferenceCameraProps {
  /** Whether this camera controller is enabled */
  enabled?: boolean;
  /** Reference canvas size for scaling calculations */
  referenceSize?: { width: number; height: number };
  /** Base camera dimensions in world space */
  baseDimensions?: { width: number; height: number };
}

/**
 * Fixed Reference Camera Controller
 *
 * Establishes a stable reference coordinate system that compensates for R3F's
 * automatic camera adjustments when the canvas resizes. This prevents content
 * from shrinking with padding when the canvas gets smaller.
 *
 * Key principles:
 * - Captures initial canvas size as baseline reference
 * - Calculates compensation factor for current vs reference size
 * - Applies compensation to camera frustum to maintain visual consistency
 * - Preserves gesture system compatibility by maintaining coordinate relationships
 * - Works WITH R3F instead of fighting against it
 *
 * Usage: Place this component at the root of your Canvas content, before other
 * camera controllers or content that depends on stable coordinates.
 */
export function FixedReferenceCamera({
  enabled = true,
  referenceSize = { width: 800, height: 600 },
  baseDimensions = { width: 400, height: 300 },
}: FixedReferenceCameraProps): ReactNode {
  const { camera, size } = useThree();

  // Store initial size and scale factor
  const initialSize = useRef<{ width: number; height: number } | null>(null);
  const baseScale = useRef<number>(1);
  const isInitialized = useRef<boolean>(false);

  // Capture reference size when canvas reaches reasonable dimensions
  useEffect(() => {
    if (
      !enabled ||
      initialSize.current ||
      size.width < 200 ||
      size.height < 100
    ) {
      return;
    }

    // Store the initial canvas size as our reference
    initialSize.current = { width: size.width, height: size.height };

    // Calculate base scale factor relative to our reference size
    baseScale.current = Math.min(
      size.width / referenceSize.width,
      size.height / referenceSize.height
    );

    isInitialized.current = true;

    console.log("FixedReferenceCamera initialized:", {
      initialSize: initialSize.current,
      baseScale: baseScale.current,
      referenceSize,
    });
  }, [enabled, size.width, size.height, referenceSize.width, referenceSize.height]);

  useFrame(() => {
    if (
      !enabled ||
      !isInitialized.current ||
      !initialSize.current ||
      camera.type !== "OrthographicCamera"
    ) {
      return;
    }

    const orthoCamera = camera as THREE.OrthographicCamera;

    // Calculate current scale factor
    const currentScale = Math.min(
      size.width / referenceSize.width,
      size.height / referenceSize.height
    );

    // Calculate compensation factor to maintain visual consistency
    // When canvas shrinks, currentScale < baseScale, so compensationFactor > 1
    // This enlarges the camera frustum to counteract the visual shrinking
    const compensationFactor = baseScale.current / currentScale;

    // Apply compensation to camera frustum
    const compensatedWidth = baseDimensions.width * compensationFactor;
    const compensatedHeight = baseDimensions.height * compensationFactor;

    orthoCamera.left = -compensatedWidth;
    orthoCamera.right = compensatedWidth;
    orthoCamera.top = compensatedHeight;
    orthoCamera.bottom = -compensatedHeight;

    orthoCamera.updateProjectionMatrix();
  });

  // Reset when component unmounts or is disabled
  useEffect(() => {
    return () => {
      if (camera.type === "OrthographicCamera") {
        const orthoCamera = camera as THREE.OrthographicCamera;

        // Restore original camera dimensions
        orthoCamera.left = -baseDimensions.width;
        orthoCamera.right = baseDimensions.width;
        orthoCamera.top = baseDimensions.height;
        orthoCamera.bottom = -baseDimensions.height;
        orthoCamera.updateProjectionMatrix();
      }
    };
  }, [camera, baseDimensions.width, baseDimensions.height]);

  // This component doesn't render anything - it's just a camera controller
  return null;
}

/**
 * Utility function to calculate the current compensation factor
 * Useful for other components that need to adjust their behavior based on
 * the same scaling logic used by FixedReferenceCamera
 */
export function useCompensationFactor(
  referenceSize: { width: number; height: number } = { width: 800, height: 600 }
): number {
  const { size } = useThree();
  const baseScale = useRef<number | null>(null);

  // Initialize base scale on first call
  if (baseScale.current === null && size.width > 200 && size.height > 100) {
    baseScale.current = Math.min(
      size.width / referenceSize.width,
      size.height / referenceSize.height
    );
  }

  if (baseScale.current === null) {
    return 1; // No compensation if not initialized
  }

  const currentScale = Math.min(
    size.width / referenceSize.width,
    size.height / referenceSize.height
  );

  return baseScale.current / currentScale;
}
