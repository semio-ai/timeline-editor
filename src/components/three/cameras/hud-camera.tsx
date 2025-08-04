import type { ReactNode } from "react";
import { useCameraSync } from "../../../hooks/use-camera-sync";
import type { RegionBounds } from "../layout/types";

export interface HUDCameraProps {
  /** Region bounds for this HUD layer */
  bounds: RegionBounds;
  /** HUD render priority/layer number */
  layer: number;
  /** Whether this camera is active */
  enabled?: boolean;
  /** Children components that need camera sync */
  children: ReactNode;
}

/**
 * HUD content synchronizer for HUD regions (Top Ruler, Timeline, etc.).
 * Provides camera sync state to child components within HUD layers.
 *
 * Note: HUD components in R3F have their own camera system, so we don't
 * manipulate the camera directly. Instead, we provide sync state that
 * child components can use to position and scale their content.
 */
export function HUDCamera({ bounds, layer, enabled = true, children }: HUDCameraProps): ReactNode {
  const { zoom, pan, viewport } = useCameraSync();

  if (!enabled) {
    return null;
  }

  // Pass camera sync state through a group that child components can access
  // The HUD's own camera remains unchanged, but content can be positioned/scaled
  return (
    <group
      userData={{
        cameraSync: { zoom, pan, viewport },
        bounds,
        layer,
      }}
    >
      {children}
    </group>
  );
}
