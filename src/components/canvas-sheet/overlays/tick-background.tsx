import { memo, useRef, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Theme } from "@semio/ui";
import { isOrthographicCamera } from "@semio/utils";
import { useAnimationStore } from "../../../hooks";
import type { AnimationData } from "../../../store-types";
import { computeTickIntervals } from "../../../functions/compute-tick-interval";
import { Z } from "../../../constants";

interface TickBackgroundProps {
  height: number;
  theme?: Theme.Light | Theme.Dark;
  opacity?: number;
}

// Minimum pixel spacing for major ticks in the content area (less than ruler)
const CONTENT_MIN_MAJOR_PX = 40;

const vertexShader = /* glsl */ `
  varying vec2 vWorldPos;
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uMajorIntervalMs;
  uniform float uMinorIntervalMs;
  uniform float uPixelsPerMs;
  uniform vec3 uMajorColor;
  uniform vec3 uMinorColor;
  uniform float uTickWidthPx;
  uniform float uBaseOpacity;

  varying vec2 vWorldPos;

  void main() {
    if (uMajorIntervalMs < 0.001 || uPixelsPerMs < 0.0001) discard;

    float x = vWorldPos.x;
    float halfWidth = uTickWidthPx * 0.5;

    // Major tick
    float nearestMajor = floor(x / uMajorIntervalMs + 0.5);
    float distMajorPx = abs(x - nearestMajor * uMajorIntervalMs) * uPixelsPerMs;
    float majorAlpha = 1.0 - smoothstep(halfWidth - 0.5, halfWidth + 0.5, distMajorPx);

    // Minor tick — only if interval differs from major
    float minorAlpha = 0.0;
    if (uMinorIntervalMs > 0.001 && uMinorIntervalMs < uMajorIntervalMs - 0.001) {
      float nearestMinor = floor(x / uMinorIntervalMs + 0.5);
      float distMinorPx = abs(x - nearestMinor * uMinorIntervalMs) * uPixelsPerMs;
      minorAlpha = 1.0 - smoothstep(halfWidth - 0.5, halfWidth + 0.5, distMinorPx);
    }

    float isMajor = step(0.01, majorAlpha);
    vec3 color = mix(uMinorColor, uMajorColor, isMajor);
    float alpha = max(majorAlpha, minorAlpha * 0.7 * (1.0 - majorAlpha)) * uBaseOpacity;

    if (alpha < 0.001) discard;
    gl_FragColor = vec4(color, alpha);
  }
`;

export const TickBackground = memo(function TickBackground({
  height,
  theme = Theme.Light,
  opacity = 1,
}: TickBackgroundProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const framerate = useAnimationStore(
    useShallow((state: AnimationData) => state.framerate as number),
  );

  const majorColor = theme === Theme.Light ? new THREE.Color("#C0C0C0") : new THREE.Color("#E0E0E0");
  const minorColor = theme === Theme.Light ? new THREE.Color("#D0D0D0") : new THREE.Color("#808080");

  const uniforms = useMemo(
    () => ({
      uMajorIntervalMs: { value: 1000 },
      uMinorIntervalMs: { value: 500 },
      uPixelsPerMs: { value: 1 },
      uMajorColor: { value: majorColor },
      uMinorColor: { value: minorColor },
      uTickWidthPx: { value: 1.0 },
      uBaseOpacity: { value: opacity },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useFrame(({ camera, size }) => {
    if (!isOrthographicCamera(camera) || !materialRef.current || !meshRef.current) return;

    const frustumWidth = camera.right - camera.left;
    if (frustumWidth <= 0 || size.width <= 0) return;

    meshRef.current.position.x = (camera.left + camera.right) / 2;
    meshRef.current.scale.x = frustumWidth;

    const pixelsPerMs = size.width / frustumWidth;
    const { majorMs, minorMs } = computeTickIntervals(
      framerate,
      pixelsPerMs,
      CONTENT_MIN_MAJOR_PX,
    );

    const mat = materialRef.current;
    mat.uniforms.uMajorIntervalMs.value = majorMs;
    mat.uniforms.uMinorIntervalMs.value = minorMs;
    mat.uniforms.uPixelsPerMs.value = pixelsPerMs;
    mat.uniforms.uMajorColor.value = majorColor;
    mat.uniforms.uMinorColor.value = minorColor;
    mat.uniforms.uBaseOpacity.value = opacity;
  });

  return (
    <mesh ref={meshRef} position={[0, 0, Z.Ticks]}>
      <planeGeometry args={[1, height]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        toneMapped={false}
        depthWrite={false}
      />
    </mesh>
  );
});
