import { useMemo, useEffect } from "react";
import { MotionValue } from "motion";
import { ShaderMaterial, Color, Vector2, Vector4 } from "three";
import { useThree, useFrame } from "@react-three/fiber";
import { Theme } from "@semio/ui";
import { getHighlightColor, ThemeMode } from "../functions";

const vertexShader = `
  uniform vec4 frustumBounds; // left, right, bottom, top
  uniform vec2 viewportSize;
  uniform float cameraZoom;
  uniform float measureFromBottom;

  varying vec2 vScreenPos;

  void main() {
    // Calculate world position of this vertex
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);

    // Account for camera zoom in frustum calculations
    float zoomedLeft = frustumBounds.x / cameraZoom;
    float zoomedRight = frustumBounds.y / cameraZoom;
    float zoomedBottom = frustumBounds.z / cameraZoom;
    float zoomedTop = frustumBounds.w / cameraZoom;

    float frustumWidth = zoomedRight - zoomedLeft;
    float frustumHeight = zoomedTop - zoomedBottom;

    // Transform to screen pixels for true 45-degree diagonals
    // X is measured from left (as before)
    // Y can be measured from TOP (for scrolling elements) or BOTTOM (for bottom-anchored HUDs)
    float yFromTop = ((zoomedTop - worldPosition.y) / frustumHeight) * viewportSize.y;
    float yFromBottom = ((worldPosition.y - zoomedBottom) / frustumHeight) * viewportSize.y;

    vScreenPos = vec2(
      ((worldPosition.x - zoomedLeft) / frustumWidth) * viewportSize.x,
      mix(yFromTop, yFromBottom, measureFromBottom)
    );

    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform vec3 color;
  uniform float opacity;
  uniform float baselineOpacity;
  uniform float stripeWidth;
  uniform float stripeSpacing;
  uniform float yOffset;
  uniform float measureFromBottom;

  varying vec2 vScreenPos;

  void main() {
    // Use different diagonal calculation based on measurement direction
    // For bottom-measured (timeline): subtract for correct diagonal
    // For top-measured (track list): add for correct diagonal
    float diagonal = measureFromBottom > 0.5
      ? vScreenPos.x - (vScreenPos.y + yOffset)  // Timeline HUD
      : vScreenPos.x + (vScreenPos.y + yOffset); // Track list
    float pattern = mod(diagonal, stripeSpacing);
    float stripeAlpha = step(pattern, stripeWidth);

    // Blend baseline opacity with stripe
    float finalAlpha = mix(baselineOpacity * opacity, opacity, stripeAlpha);

    if (finalAlpha < 0.01) discard;
    gl_FragColor = vec4(color, finalAlpha);
  }
`;

export interface DiagonalMaterialOptions {
  color?: string | number;
  opacity?: number;
  baselineOpacity?: number;
  stripeWidth?: number;
  stripeSpacing?: number;
  theme?: ThemeMode;
  useHighlight?: boolean;
  yOffset?: MotionValue<number>;
  measureFromBottom?: boolean;
}

export function useDiagonalMaterial({
  color = "#ff0000",
  opacity = 0.6,
  baselineOpacity = 0.2,
  stripeWidth = 8.0,
  stripeSpacing = 16.0,
  theme = Theme.Light,
  useHighlight = false,
  yOffset = new MotionValue(0),
  measureFromBottom = false,
}: DiagonalMaterialOptions = {}) {
  const { camera, viewport } = useThree();

  const finalColor = useMemo(() => {
    if (useHighlight && typeof color === "string") {
      return getHighlightColor(color, theme);
    }
    return color;
  }, [color, theme, useHighlight]);

  console.log("finalColor", finalColor);

  const material = useMemo(() => {
    return new ShaderMaterial({
      transparent: true,
      vertexShader,
      fragmentShader,
      uniforms: {
        color: { value: new Color(finalColor) },
        opacity: { value: opacity },
        baselineOpacity: { value: baselineOpacity },
        stripeWidth: { value: stripeWidth },
        stripeSpacing: { value: stripeSpacing },
        frustumBounds: { value: new Vector4(-1, 1, -1, 1) },
        viewportSize: { value: new Vector2(800, 600) },
        cameraZoom: { value: 1.0 },
        yOffset: { value: yOffset.get() },
        measureFromBottom: { value: measureFromBottom ? 1.0 : 0.0 },
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- We want to prevent recreation and instead update uniforms
  }, []);

  useFrame(() => {
    if (material.uniforms && "isOrthographicCamera" in camera) {
      const orthoCamera = camera as any;
      material.uniforms.frustumBounds.value = new Vector4(
        orthoCamera.left as number,
        orthoCamera.right as number,
        orthoCamera.bottom as number,
        orthoCamera.top as number,
      );
      material.uniforms.viewportSize.value.set(viewport.width, viewport.height);
      material.uniforms.cameraZoom.value = orthoCamera.zoom || 1.0;
      material.uniforms.yOffset.value = yOffset.get();
    }
  });

  useEffect(() => {
    if (material.uniforms) {
      material.uniforms.color.value.set(finalColor);
      material.uniforms.opacity.value = opacity;
      material.uniforms.baselineOpacity.value = baselineOpacity;
      material.uniforms.stripeWidth.value = stripeWidth;
      material.uniforms.stripeSpacing.value = stripeSpacing;
      material.uniforms.yOffset.value = yOffset.get();
      material.uniforms.measureFromBottom.value = measureFromBottom ? 1.0 : 0.0;
      material.needsUpdate = true;
    }
  }, [
    material,
    finalColor,
    opacity,
    baselineOpacity,
    stripeWidth,
    stripeSpacing,
    yOffset,
    measureFromBottom,
  ]);

  useEffect(() => {
    return () => {
      material.dispose();
    };
  }, [material]);

  return material;
}
