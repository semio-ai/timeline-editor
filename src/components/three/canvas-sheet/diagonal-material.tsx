import { useMemo, useEffect } from "react";
import { MotionValue } from "motion";
import { ShaderMaterial, Color, Vector2, Vector4 } from "three";
import { useThree, useFrame } from "@react-three/fiber";
import { Theme } from "@semio/ui";
import { getHighlightColor, ThemeMode } from "../../../functions";

const vertexShader = `
  uniform vec4 frustumBounds; // left, right, bottom, top
  uniform vec2 viewportSize;
  uniform float cameraZoom;

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

    // Transform to normalized frustum space [0,1]
    vec2 frustumPos = vec2(
      (worldPosition.x - zoomedLeft) / frustumWidth,
      (worldPosition.y - zoomedBottom) / frustumHeight
    );

    // Transform to screen pixels for true 45-degree diagonals
    vScreenPos = frustumPos * viewportSize;

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

  varying vec2 vScreenPos;

  void main() {
    float diagonal = vScreenPos.x - (vScreenPos.y - yOffset);
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
}

export function useDiagonalMaterial({
  color = "#ff0000",
  opacity = 0.6,
  baselineOpacity = 0.2,
  stripeWidth = 8.0,
  stripeSpacing = 16.0,
  theme = Theme.Light,
  useHighlight = true,
  yOffset = new MotionValue(0),
}: DiagonalMaterialOptions = {}) {
  const { camera, viewport } = useThree();

  const finalColor = useMemo(() => {
    if (useHighlight && typeof color === "string") {
      return getHighlightColor(color, theme);
    }
    return color;
  }, [color, theme, useHighlight]);

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
      material.needsUpdate = true;
    }
  }, [material, finalColor, opacity, baselineOpacity, stripeWidth, stripeSpacing, yOffset]);

  useEffect(() => {
    return () => {
      material.dispose();
    };
  }, [material]);

  return material;
}
