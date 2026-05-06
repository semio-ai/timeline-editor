import { ReactNode, memo, useEffect, useMemo } from "react";
import { useFrame, useThree, type Size } from "@react-three/fiber";
import * as THREE from "three";
import { useMotionValue } from "motion/react";
import { isOrthographicCamera } from "@semio/utils";
import { MotionCanvasContext } from "./motion-canvas-context";

export const MotionCanvasProvider = memo(function MotionCanvasProvider({
  children,
  label,
}: {
  label?: string;
  children: ReactNode;
}) {
  const invalidate = useThree((state) => state.invalidate);
  const width = useMotionValue(1);
  const height = useMotionValue(1);
  const invariantScaleX = useMotionValue(1);
  const invariantScaleY = useMotionValue(1);
  const frustumTop = useMotionValue(1);
  const frustumBottom = useMotionValue(-1);
  const frustumLeft = useMotionValue(-1);
  const frustumRight = useMotionValue(1);

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(
    () => ({
      size: { width, height },
      invariantScaleX,
      invariantScaleY,
      frustum: {
        top: frustumTop,
        bottom: frustumBottom,
        left: frustumLeft,
        right: frustumRight,
      },
    }),
    [
      width,
      height,
      invariantScaleX,
      invariantScaleY,
      frustumTop,
      frustumBottom,
      frustumLeft,
      frustumRight,
    ],
  ); // MotionValues are stable, so this will only create once

  // Update scale on each frame to maintain constant pixel size
  useFrame(({ size, camera }) => {
    if (label && camera.name !== label) {
      console.log(`Mismatched Camera (${label} !== ${camera.name})`);
      return;
    }
    // Wait for valid canvas size before updating motion values
    if (size.width <= 0 || size.height <= 0) {
      return;
    }

    if (!isOrthographicCamera(camera)) return;
    const scaleFactor = calculateScaleFactor(camera, size);
    invariantScaleX.set(scaleFactor);
    invariantScaleY.set(calculateScaleFactorY(camera, size));
    width.set(size.width);
    height.set(size.height);
    frustumTop.set(camera.top);
    frustumBottom.set(camera.bottom);
    frustumLeft.set(camera.left);
    frustumRight.set(camera.right);
  }, -1);

  useEffect(() => {
    const forceUpdate = () => {
      requestAnimationFrame(() => {
        // This will trigger useFrame to run again with proper canvas dimensions
        invalidate();
      });
    };
    // Small delay to ensure canvas is fully mounted
    const timeout = setTimeout(forceUpdate, 16);
    return () => clearTimeout(timeout);
  }, [invalidate]);

  return (
    <MotionCanvasContext.Provider value={contextValue}>{children}</MotionCanvasContext.Provider>
  );
});

const calculateScaleFactor = (camera: THREE.OrthographicCamera, viewport: Size) => {
  const baseWidth = viewport.width;
  const currentWidth = camera.right - camera.left;
  return currentWidth / baseWidth;
};

const calculateScaleFactorY = (camera: THREE.OrthographicCamera, viewport: Size) => {
  const baseHeight = viewport.height;
  const currentHeight = camera.top - camera.bottom;
  return currentHeight / baseHeight;
};
