import { ReactNode, memo, useMemo } from "react";
import { useFrame, type Size } from "@react-three/fiber";
import * as THREE from "three";
import { useMotionValue } from "motion/react";
import { MotionCanvasContext } from "./motion-canvas-context";

export const MotionCanvasProvider = memo(function MotionCanvasProvider({
  children,
}: {
  children: ReactNode;
}) {
  const width = useMotionValue(1);
  const height = useMotionValue(1);
  const invariantScale = useMotionValue(1);
  const frustumTop = useMotionValue(1);
  const frustumBottom = useMotionValue(-1);
  const frustumLeft = useMotionValue(-1);
  const frustumRight = useMotionValue(1);

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(
    () => ({
      size: { width, height },
      invariantScale,
      frustum: {
        top: frustumTop,
        bottom: frustumBottom,
        left: frustumLeft,
        right: frustumRight,
      },
    }),
    [width, height, invariantScale, frustumTop, frustumBottom, frustumLeft, frustumRight],
  ); // MotionValues are stable, so this will only create once

  // Update scale on each frame to maintain constant pixel size
  useFrame(({ viewport, camera }) => {
    const scaleFactor = calculateScaleFactor(camera as THREE.OrthographicCamera, viewport);
    invariantScale.set(scaleFactor);
    width.set(viewport.width);
    height.set(viewport.height);
    frustumTop.set((camera as THREE.OrthographicCamera).top);
    frustumBottom.set((camera as THREE.OrthographicCamera).bottom);
    frustumLeft.set((camera as THREE.OrthographicCamera).left);
    frustumRight.set((camera as THREE.OrthographicCamera).right);
  });

  return (
    <MotionCanvasContext.Provider value={contextValue}>{children}</MotionCanvasContext.Provider>
  );
});

const calculateScaleFactor = (camera: THREE.OrthographicCamera, viewport: Size) => {
  const baseWidth = viewport.width;
  const currentWidth =
    (camera as THREE.OrthographicCamera).right - (camera as THREE.OrthographicCamera).left;
  return currentWidth / baseWidth;
};
