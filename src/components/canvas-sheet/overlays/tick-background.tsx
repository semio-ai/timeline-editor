import { memo, useRef, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Theme } from "@semio/ui";
import { usePlayerStore, isOrthographicCamera } from "@semio/utils";
import { useAnimationStore } from "../../../hooks";
import type { AnimationData } from "../../../store-types";
import { Z } from "../../../constants";

interface TickBackgroundProps {
  height: number;
  theme?: Theme.Light | Theme.Dark;
  opacity?: number;
}

const vertexShader = /* glsl */ `
  varying vec2 vWorldPos;
  void main() {
    // Pass world-space position to fragment shader
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uFrameDurationMs;
  uniform float uFramerate;
  uniform float uPixelsPerMs;
  uniform vec3 uMajorColor;
  uniform vec3 uMinorColor;
  uniform float uTickWidthPx;
  uniform float uBaseOpacity;

  varying vec2 vWorldPos;

  void main() {
    if (uFrameDurationMs < 0.001 || uPixelsPerMs < 0.0001) discard;

    float x = vWorldPos.x;

    // How many pixels per frame at current zoom
    float pixelsPerFrame = uPixelsPerMs * uFrameDurationMs;

    // Distance to nearest frame boundary (in ms)
    float nearestFrame = floor(x / uFrameDurationMs + 0.5);
    float distToFrame = abs(x - nearestFrame * uFrameDurationMs);

    // Distance to nearest major (second) boundary
    float majorInterval = uFrameDurationMs * uFramerate;
    float nearestMajor = floor(x / majorInterval + 0.5);
    float distToMajor = abs(x - nearestMajor * majorInterval);

    // Convert distances to pixels
    float distToFramePx = distToFrame * uPixelsPerMs;
    float distToMajorPx = distToMajor * uPixelsPerMs;

    // Tick half-width in pixels
    float halfWidth = uTickWidthPx * 0.5;

    // Major tick: always visible
    float majorAlpha = 1.0 - smoothstep(halfWidth - 0.5, halfWidth + 0.5, distToMajorPx);

    // Minor tick: fade out when frames get too dense
    // Start fading when pixels-per-frame < 6, fully gone at < 2
    float minorFade = smoothstep(2.0, 6.0, pixelsPerFrame);
    float minorAlpha = (1.0 - smoothstep(halfWidth - 0.5, halfWidth + 0.5, distToFramePx)) * minorFade;

    // Combine: major takes priority
    float isMajor = step(0.01, majorAlpha);
    vec3 color = mix(uMinorColor, uMajorColor, isMajor);
    float alpha = max(majorAlpha, minorAlpha * (1.0 - majorAlpha)) * uBaseOpacity;

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

  const frameDurationMs = framerate > 0 ? 1000 / framerate : 1000;

  const majorColor = theme === Theme.Light ? new THREE.Color("#C0C0C0") : new THREE.Color("#E0E0E0");
  const minorColor = theme === Theme.Light ? new THREE.Color("#D0D0D0") : new THREE.Color("#808080");

  const uniforms = useMemo(
    () => ({
      uFrameDurationMs: { value: frameDurationMs },
      uFramerate: { value: framerate },
      uPixelsPerMs: { value: 1 },
      uMajorColor: { value: majorColor },
      uMinorColor: { value: minorColor },
      uTickWidthPx: { value: 1.0 },
      uBaseOpacity: { value: opacity },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Update uniforms every frame to track camera frustum
  useFrame(({ camera, size }) => {
    if (!isOrthographicCamera(camera) || !materialRef.current || !meshRef.current) return;

    const frustumLeft = camera.left;
    const frustumRight = camera.right;
    const frustumWidth = frustumRight - frustumLeft;
    if (frustumWidth <= 0 || size.width <= 0) return;
    const center = (frustumLeft + frustumRight) / 2;

    // Position and scale the quad to cover the full frustum
    meshRef.current.position.x = center;
    meshRef.current.scale.x = frustumWidth;

    // Update uniforms
    const mat = materialRef.current;
    mat.uniforms.uFrameDurationMs.value = frameDurationMs;
    mat.uniforms.uFramerate.value = framerate;
    mat.uniforms.uPixelsPerMs.value = size.width / frustumWidth;
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
