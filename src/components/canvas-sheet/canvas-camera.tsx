import { memo, useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { useMotionValueEvent } from "motion/react";
import { isOrthographicCamera } from "@semio/utils";
import { calculatePaddedFrustum } from "../../viewport-utils";
import { viewportMotion } from "../../viewport-state";
import { useAnimationStore } from "../../hooks/use-animation-store";
import { useMotionCanvas } from "./shared/motion-canvas-context";

/**
 * Imperatively manages camera bounds for a per-canvas region in the split
 * canvas-sheet layout. Replaces the old `<Hud>` + `HudCamera` machinery —
 * each canvas owns its own camera; this component keeps it in sync with
 * the shared viewport state.
 *
 * - `mode="moving"`: X subscribes to `viewportMotion` (panned/zoomed window).
 *   Used by the top canvas (ruler + timeline).
 * - `mode="fixed"`: X is `[0, max(duration, 1000)]`. Used by the bottom
 *   canvas (minimap + bottom ruler).
 *
 * Y is pixel-locked: `camera.top = h/2`, `camera.bottom = -h/2`. The main
 * tracks canvas does NOT use this component — its Y is mode-aware (driven
 * by `splineCameraYMotion` / `trackScrollMotion` via TracksRenderer) and
 * its X is driven by `PanZoomControls` (which already subscribes to
 * `viewportMotion` and handles user gestures).
 */
export const CanvasCamera = memo(function CanvasCamera({
  mode,
}: {
  mode: "moving" | "fixed";
}) {
  const camera = useThree((s) => s.camera);
  const playerStore = useAnimationStore((state) => state.playerStore);
  const { size: motionSize } = useMotionCanvas();
  const modeRef = useRef(mode);
  modeRef.current = mode;

  useEffect(() => {
    if (!isOrthographicCamera(camera)) return;

    const updateCam = () => {
      const width = motionSize.width.get();
      const height = motionSize.height.get();
      if (width <= 0) return;
      let dataVp: [number, number];
      if (modeRef.current === "fixed") {
        const dur = playerStore.getState().player.duration;
        dataVp = [0, Math.max(dur, 1000)];
      } else {
        dataVp = viewportMotion.get();
      }
      const { left, right } = calculatePaddedFrustum(dataVp, width);
      camera.left = left;
      camera.right = right;
      if (height > 0) {
        camera.top = height / 2;
        camera.bottom = -height / 2;
      }
      camera.updateProjectionMatrix();
    };

    updateCam();

    const unsubViewport = viewportMotion.on("change", () => {
      if (modeRef.current === "moving") updateCam();
    });
    const unsubDuration = playerStore.subscribe(
      (s) => s.player.duration,
      () => updateCam(),
    );
    return () => {
      unsubViewport();
      unsubDuration();
    };
  }, [camera, motionSize, playerStore]);

  // Resize handlers — re-derive camera bounds when the canvas DOM element
  // changes size. Width drives X-frustum padding; height drives pixel-lock.
  useMotionValueEvent(motionSize.width, "change", (width) => {
    if (!isOrthographicCamera(camera) || width <= 0) return;
    const dataVp =
      modeRef.current === "fixed"
        ? ([0, Math.max(playerStore.getState().player.duration, 1000)] as [number, number])
        : viewportMotion.get();
    const { left, right } = calculatePaddedFrustum(dataVp, width);
    camera.left = left;
    camera.right = right;
    camera.updateProjectionMatrix();
  });

  useMotionValueEvent(motionSize.height, "change", (height) => {
    if (!isOrthographicCamera(camera) || height <= 0) return;
    camera.top = height / 2;
    camera.bottom = -height / 2;
    camera.updateProjectionMatrix();
  });

  return null;
});
