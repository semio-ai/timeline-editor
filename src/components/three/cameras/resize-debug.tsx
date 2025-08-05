import type { ReactNode } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useRef, useEffect } from "react";
import * as THREE from "three";

export interface ResizeDebugProps {
  /** Whether to enable logging */
  enabled?: boolean;
  /** How often to log (every N frames) */
  logInterval?: number;
  /** Whether to render visual debug info */
  showVisual?: boolean;
}

/**
 * R3F Resize Behavior Investigation Component
 *
 * This component tracks and logs what happens when the canvas resizes
 * to help understand the root cause of the content shrinking issue.
 *
 * Key metrics tracked:
 * - Canvas size changes
 * - Camera property changes
 * - Viewport changes
 * - Aspect ratio changes
 * - Coordinate transformations
 */
export function ResizeDebug({
  enabled = true,
  logInterval = 60, // Log every 60 frames (~1 second at 60fps)
  showVisual = false,
}: ResizeDebugProps): ReactNode {
  const { camera, size, viewport, gl } = useThree();

  // Previous values for comparison
  const prevSize = useRef<{ width: number; height: number } | null>(null);
  const prevCamera = useRef<any>(null);
  const prevViewport = useRef<any>(null);
  const frameCount = useRef<number>(0);

  // Initialize tracking
  useEffect(() => {
    if (!enabled) return;

    console.log("🔍 ResizeDebug: Starting R3F resize investigation");
    console.log("Initial state:", {
      canvasSize: { width: size.width, height: size.height },
      canvasAspect: size.width / size.height,
      cameraType: camera.type,
      camera:
        camera.type === "OrthographicCamera"
          ? {
              left: (camera as THREE.OrthographicCamera).left,
              right: (camera as THREE.OrthographicCamera).right,
              top: (camera as THREE.OrthographicCamera).top,
              bottom: (camera as THREE.OrthographicCamera).bottom,
              zoom: camera.zoom,
            }
          : null,
      domElement: {
        width: gl.domElement.width,
        height: gl.domElement.height,
        clientWidth: gl.domElement.clientWidth,
        clientHeight: gl.domElement.clientHeight,
      },
    });

    // Store initial values
    prevSize.current = { width: size.width, height: size.height };
    if (camera.type === "OrthographicCamera") {
      const orthoCamera = camera as THREE.OrthographicCamera;
      prevCamera.current = {
        left: orthoCamera.left,
        right: orthoCamera.right,
        top: orthoCamera.top,
        bottom: orthoCamera.bottom,
        zoom: orthoCamera.zoom,
        aspect: orthoCamera.right / orthoCamera.top,
      };
    }
    prevViewport.current = { ...viewport };
  }, [enabled, camera, size, viewport, gl]);

  // Enhanced camera interference tracking
  const cameraChangeCount = useRef<number>(0);
  const lastCameraSnapshot = useRef<any>(null);

  // Track changes during resize
  useEffect(() => {
    if (!enabled || !prevSize.current) return;

    const sizeChanged =
      prevSize.current.width !== size.width || prevSize.current.height !== size.height;

    if (sizeChanged) {
      console.log("📏 ResizeDebug: Canvas size changed");
      console.log("Size change:", {
        from: prevSize.current,
        to: { width: size.width, height: size.height },
        aspectChange: {
          from: prevSize.current.width / prevSize.current.height,
          to: size.width / size.height,
        },
      });

      // Check what happened to camera
      if (camera.type === "OrthographicCamera" && prevCamera.current) {
        const orthoCamera = camera as THREE.OrthographicCamera;
        const cameraChanged =
          prevCamera.current.left !== orthoCamera.left ||
          prevCamera.current.right !== orthoCamera.right ||
          prevCamera.current.top !== orthoCamera.top ||
          prevCamera.current.bottom !== orthoCamera.bottom;

        if (cameraChanged) {
          console.log("📷 ResizeDebug: Camera changed with canvas resize");
          console.log("Camera change:", {
            from: prevCamera.current,
            to: {
              left: orthoCamera.left,
              right: orthoCamera.right,
              top: orthoCamera.top,
              bottom: orthoCamera.bottom,
              zoom: orthoCamera.zoom,
              aspect: orthoCamera.right / orthoCamera.top,
            },
            frustumSize: {
              from: {
                width: prevCamera.current.right - prevCamera.current.left,
                height: prevCamera.current.top - prevCamera.current.bottom,
              },
              to: {
                width: orthoCamera.right - orthoCamera.left,
                height: orthoCamera.top - orthoCamera.bottom,
              },
            },
          });

          // Check for camera reversion pattern
          const currentFrustumWidth = orthoCamera.right - orthoCamera.left;
          const expectedFrustumWidth = size.width;
          const isCorrectSize = Math.abs(currentFrustumWidth - expectedFrustumWidth) < 1;
          const isPreviousSize =
            lastCameraSnapshot.current &&
            Math.abs(currentFrustumWidth - lastCameraSnapshot.current.frustumWidth) < 1;

          if (!isCorrectSize && isPreviousSize) {
            console.warn("⚠️ CAMERA REVERSION DETECTED!");
            console.warn("Camera reverted from correct size back to previous size:", {
              expectedWidth: expectedFrustumWidth,
              actualWidth: currentFrustumWidth,
              revertedToPrevious: lastCameraSnapshot.current.frustumWidth,
              canvasSize: { width: size.width, height: size.height },
            });
          }
        } else {
          console.log("📷 ResizeDebug: Camera unchanged despite canvas resize");
        }

        // Update tracking
        prevCamera.current = {
          left: orthoCamera.left,
          right: orthoCamera.right,
          top: orthoCamera.top,
          bottom: orthoCamera.bottom,
          zoom: orthoCamera.zoom,
          aspect: orthoCamera.right / orthoCamera.top,
        };
      }

      // Check viewport changes
      const viewportChanged = JSON.stringify(prevViewport.current) !== JSON.stringify(viewport);
      if (viewportChanged) {
        console.log("🖼️ ResizeDebug: Viewport changed");
        console.log("Viewport change:", {
          from: prevViewport.current,
          to: viewport,
        });
        prevViewport.current = { ...viewport };
      }

      // Update size tracking
      prevSize.current = { width: size.width, height: size.height };
    }
  }, [enabled, size, camera, viewport]);

  // Enhanced per-frame camera interference detection
  useFrame(() => {
    if (!enabled) return;

    frameCount.current++;

    // Track camera changes every frame during resize
    if (camera.type === "OrthographicCamera") {
      const orthoCamera = camera as THREE.OrthographicCamera;
      const currentSnapshot = {
        frustumWidth: orthoCamera.right - orthoCamera.left,
        frustumHeight: orthoCamera.top - orthoCamera.bottom,
        left: orthoCamera.left,
        right: orthoCamera.right,
        top: orthoCamera.top,
        bottom: orthoCamera.bottom,
        zoom: orthoCamera.zoom,
        frame: frameCount.current,
      };

      // Detect frame-by-frame camera changes
      if (lastCameraSnapshot.current) {
        const changed =
          Math.abs(currentSnapshot.frustumWidth - lastCameraSnapshot.current.frustumWidth) > 0.1 ||
          Math.abs(currentSnapshot.frustumHeight - lastCameraSnapshot.current.frustumHeight) > 0.1;

        if (changed) {
          cameraChangeCount.current++;
          const frameDiff = frameCount.current - lastCameraSnapshot.current.frame;

          console.log(`🔍 Frame-by-frame camera change #${cameraChangeCount.current}:`, {
            frameInterval: frameDiff,
            from: {
              frustumWidth: lastCameraSnapshot.current.frustumWidth,
              frustumHeight: lastCameraSnapshot.current.frustumHeight,
              frame: lastCameraSnapshot.current.frame,
            },
            to: {
              frustumWidth: currentSnapshot.frustumWidth,
              frustumHeight: currentSnapshot.frustumHeight,
              frame: currentSnapshot.frame,
            },
            canvasSize: { width: size.width, height: size.height },
            mismatch: {
              widthDiff: currentSnapshot.frustumWidth - size.width,
              heightDiff: currentSnapshot.frustumHeight - size.height,
            },
          });

          // Detect interference patterns
          const expectedWidth = size.width;
          const expectedHeight = size.height;
          const isMovingTowardCorrect =
            Math.abs(currentSnapshot.frustumWidth - expectedWidth) <
            Math.abs(lastCameraSnapshot.current.frustumWidth - expectedWidth);
          const isMovingAwayFromCorrect =
            Math.abs(currentSnapshot.frustumWidth - expectedWidth) >
            Math.abs(lastCameraSnapshot.current.frustumWidth - expectedWidth);

          if (isMovingAwayFromCorrect) {
            console.warn("🚨 INTERFERENCE DETECTED: Camera moving away from correct size!");
            console.warn("Interference details:", {
              expected: { width: expectedWidth, height: expectedHeight },
              movingFrom: lastCameraSnapshot.current.frustumWidth,
              movingTo: currentSnapshot.frustumWidth,
              wrongDirection: "moving away from canvas size",
            });
          }
        }
      }

      lastCameraSnapshot.current = currentSnapshot;
    }

    // Periodic status logging
    if (frameCount.current % logInterval === 0) {
      console.log("🔄 ResizeDebug: Periodic status", {
        frame: frameCount.current,
        cameraChanges: cameraChangeCount.current,
        canvasSize: { width: size.width, height: size.height },
        canvasAspect: size.width / size.height,
        camera:
          camera.type === "OrthographicCamera"
            ? {
                frustumWidth:
                  (camera as THREE.OrthographicCamera).right -
                  (camera as THREE.OrthographicCamera).left,
                frustumHeight:
                  (camera as THREE.OrthographicCamera).top -
                  (camera as THREE.OrthographicCamera).bottom,
                zoom: camera.zoom,
              }
            : null,
      });
    }
  });

  if (!showVisual) {
    return null;
  }

  // Visual debug info
  return (
    <group>
      {/* Canvas bounds visualization */}
      <mesh position={[0, 0, -10]}>
        <planeGeometry args={[size.width / 100, size.height / 100]} />
        <meshBasicMaterial color="red" transparent opacity={0.1} />
      </mesh>

      {/* Camera frustum visualization */}
      {camera.type === "OrthographicCamera" && (
        <lineSegments position={[0, 0, -5]}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={8}
              array={
                new Float32Array([
                  // Camera frustum bounds
                  (camera as THREE.OrthographicCamera).left,
                  (camera as THREE.OrthographicCamera).top,
                  0,
                  (camera as THREE.OrthographicCamera).right,
                  (camera as THREE.OrthographicCamera).top,
                  0,
                  (camera as THREE.OrthographicCamera).right,
                  (camera as THREE.OrthographicCamera).bottom,
                  0,
                  (camera as THREE.OrthographicCamera).left,
                  (camera as THREE.OrthographicCamera).bottom,
                  0,
                  // Close the rectangle
                  (camera as THREE.OrthographicCamera).left,
                  (camera as THREE.OrthographicCamera).top,
                  0,
                  (camera as THREE.OrthographicCamera).left,
                  (camera as THREE.OrthographicCamera).bottom,
                  0,
                  (camera as THREE.OrthographicCamera).right,
                  (camera as THREE.OrthographicCamera).top,
                  0,
                  (camera as THREE.OrthographicCamera).right,
                  (camera as THREE.OrthographicCamera).bottom,
                  0,
                ])
              }
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial color="blue" />
        </lineSegments>
      )}

      {/* Size indicator text */}
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[100, 20]} />
        <meshBasicMaterial color="yellow" transparent opacity={0.8} />
      </mesh>
    </group>
  );
}

/**
 * Hook to monitor specific resize metrics
 */
export function useResizeMetrics() {
  const { camera, size, viewport } = useThree();
  const metrics = useRef({
    canvasAspect: 1,
    frustumAspect: 1,
    frustumSize: { width: 0, height: 0 },
    viewportSize: { width: 0, height: 0 },
  });

  useFrame(() => {
    if (camera.type === "OrthographicCamera") {
      const orthoCamera = camera as THREE.OrthographicCamera;
      metrics.current = {
        canvasAspect: size.width / size.height,
        frustumAspect:
          (orthoCamera.right - orthoCamera.left) / (orthoCamera.top - orthoCamera.bottom),
        frustumSize: {
          width: orthoCamera.right - orthoCamera.left,
          height: orthoCamera.top - orthoCamera.bottom,
        },
        viewportSize: {
          width: viewport.width,
          height: viewport.height,
        },
      };
    }
  });

  return metrics.current;
}

/**
 * Component to test different camera setups
 */
export function CameraTestBed({ testType = "default" }: { testType?: string }) {
  const { camera } = useThree();

  useEffect(() => {
    if (camera.type !== "OrthographicCamera") return;

    const orthoCamera = camera as THREE.OrthographicCamera;

    switch (testType) {
      case "fixed-size":
        // Test: Fixed frustum size regardless of canvas
        orthoCamera.left = -400;
        orthoCamera.right = 400;
        orthoCamera.top = 300;
        orthoCamera.bottom = -300;
        orthoCamera.updateProjectionMatrix();
        break;

      case "fixed-aspect":
        // Test: Maintain 16:9 aspect ratio
        const targetAspect = 16 / 9;
        const height = 300;
        const width = height * targetAspect;
        orthoCamera.left = -width / 2;
        orthoCamera.right = width / 2;
        orthoCamera.top = height / 2;
        orthoCamera.bottom = -height / 2;
        orthoCamera.updateProjectionMatrix();
        break;

      case "proportional":
        // Test: Scale with canvas but maintain proportions
        // This is closer to what R3F does naturally
        break;

      default:
        // Let R3F handle camera naturally
        break;
    }
  }, [testType, camera]);

  return null;
}
