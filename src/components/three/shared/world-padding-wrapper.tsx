import React from "react";
import { useThree } from "@react-three/fiber";
import { TIMELINE_PADDING } from "../../../constants";

/**
 * WorldPaddingWrapper
 *
 * Wraps children in a group that applies a horizontal world-space padding
 * corresponding to TIMELINE_PADDING pixels on both sides, regardless of zoom or canvas size.
 *
 * The children should use local coordinates in [0, 1] horizontally.
 *
 * Usage:
 * <WorldPaddingWrapper>
 *  <YourComponent />
 * </WorldPaddingWrapper>
 */
export function WorldPaddingWrapper({ children }: { children: React.ReactNode }) {
  const { size } = useThree();
  // Defensive: fallback to 1 if size.width is 0 or undefined
  const canvasWidth = size?.width || 1;
  const paddingWorld = TIMELINE_PADDING / canvasWidth;
  const dataWidthWorld = 1 - 2 * paddingWorld;

  return (
    <group position={[paddingWorld, 0, 0]} scale={[dataWidthWorld, 1, 1]}>
      {children}
    </group>
  );
}
