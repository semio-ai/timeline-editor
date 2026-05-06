import { useMemo, useEffect } from "react";
import { MotionValue } from "motion";
import { useMotionValueEvent, useSpring } from "motion/react";
import { ShaderMaterial, Color, Vector2, Vector4 } from "three";
import { useThree, useFrame } from "@react-three/fiber";
import { Theme } from "@semio/ui";
import { ThemeMode, getBackgroundElementProps, getThemeAwareOpacity } from "../functions";

const vertexShader = `
  uniform vec4 frustumBounds; // left, right, bottom, top
  uniform vec2 viewportSize;
  uniform float cameraZoom;
  uniform float measureFromBottom;

  varying vec2 vWorldPos;
  varying vec2 vPixelsPerUnit;

  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);

    // Pass world position directly — pattern is anchored to world space
    vWorldPos = worldPosition.xy;

    // Compute pixels-per-world-unit so the fragment shader can produce
    // true 45-degree diagonals at consistent pixel spacing
    float zoomedLeft = frustumBounds.x / cameraZoom;
    float zoomedRight = frustumBounds.y / cameraZoom;
    float zoomedBottom = frustumBounds.z / cameraZoom;
    float zoomedTop = frustumBounds.w / cameraZoom;

    float frustumWidth = zoomedRight - zoomedLeft;
    float frustumHeight = zoomedTop - zoomedBottom;

    vPixelsPerUnit = vec2(
      viewportSize.x / frustumWidth,
      viewportSize.y / frustumHeight
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
  uniform float globalOpacity;

  varying vec2 vWorldPos;
  varying vec2 vPixelsPerUnit;

  void main() {
    // Convert world position to pixel-equivalent coordinates.
    // This anchors the pattern to world space so it pans with content.
    // Subtract yOffset so the pattern stays locked to the violation's visual
    // position during vertical scrolling (yOffset is the scroll offset).
    float px = vWorldPos.x * vPixelsPerUnit.x;
    float py = (vWorldPos.y - yOffset) * vPixelsPerUnit.y;

    // Use consistent diagonal direction regardless of measurement mode.
    // The Y-axis direction difference between HUD and tracks is already
    // accounted for by the camera orientation — the world-space coordinates
    // produce the same visual result in both contexts.
    float diagonal = px + py;
    float pattern = mod(diagonal, stripeSpacing);
    float stripeAlpha = step(pattern, stripeWidth);

    float finalAlpha = mix(baselineOpacity, opacity, stripeAlpha) * globalOpacity;

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
  globalOpacityMV?: MotionValue<number>;
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
  globalOpacityMV,
}: DiagonalMaterialOptions = {}) {
  const { camera, viewport } = useThree();

  // Apply theme-aware processing to both color and opacity
  const { color: finalColor, opacity: themeAwareOpacity } = useMemo(() => {
    return getBackgroundElementProps(
      typeof color === "string" ? color : `#${color.toString(16).padStart(6, "0")}`,
      opacity,
      theme,
      useHighlight,
    );
  }, [color, opacity, theme, useHighlight]);

  // Apply theme awareness to baseline opacity as well
  const themeAwareBaselineOpacity = useMemo(() => {
    return getThemeAwareOpacity(baselineOpacity, theme);
  }, [baselineOpacity, theme]);

  // Initialize the spring at the theme-aware opacity to avoid per-segment intro fade.
  const opacitySpring = useSpring(themeAwareOpacity, {
    visualDuration: 0.3,
    damping: 30,
  });

  useMotionValueEvent(opacitySpring, "change", (o) => {
    if (material.uniforms) {
      material.uniforms.opacity.value = o;
    }
  });

  // Update globalOpacity uniform when the provided motion value changes.
  // Use a stable fallback MotionValue so we don't construct one per render, and
  // keep hooks order stable without subscribing to changing instances.
  const defaultGlobalOpacityMV = useMemo(() => new MotionValue(1), []);
  useMotionValueEvent(globalOpacityMV ?? defaultGlobalOpacityMV, "change", (g) => {
    if (material.uniforms) {
      material.uniforms.globalOpacity.value = g;
    }
  });

  // Animate to new theme/hover opacity targets on change, but no initial fade-in.
  useEffect(() => {
    opacitySpring.set(themeAwareOpacity);
  }, [opacitySpring, themeAwareOpacity]);

  const material = useMemo(() => {
    return new ShaderMaterial({
      transparent: true,
      vertexShader,
      fragmentShader,
      uniforms: {
        color: { value: new Color(finalColor) },
        opacity: { value: themeAwareOpacity },
        baselineOpacity: { value: themeAwareBaselineOpacity },
        stripeWidth: { value: stripeWidth },
        stripeSpacing: { value: stripeSpacing },
        frustumBounds: { value: new Vector4(-1, 1, -1, 1) },
        viewportSize: { value: new Vector2(800, 600) },
        cameraZoom: { value: 1.0 },
        yOffset: { value: yOffset.get() },
        measureFromBottom: { value: measureFromBottom ? 1.0 : 0.0 },
        globalOpacity: { value: globalOpacityMV?.get?.() ?? 1 },
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
      material.uniforms.baselineOpacity.value = themeAwareBaselineOpacity;
      material.uniforms.stripeWidth.value = stripeWidth;
      material.uniforms.stripeSpacing.value = stripeSpacing;
      material.uniforms.yOffset.value = yOffset.get();
      material.uniforms.measureFromBottom.value = measureFromBottom ? 1.0 : 0.0;
      material.uniforms.globalOpacity.value = globalOpacityMV?.get?.() ?? 1;
      material.needsUpdate = true;
    }
  }, [
    material,
    finalColor,
    themeAwareOpacity,
    themeAwareBaselineOpacity,
    stripeWidth,
    stripeSpacing,
    yOffset,
    measureFromBottom,
    globalOpacityMV,
  ]);

  useEffect(() => {
    return () => {
      material.dispose();
    };
  }, [material]);

  return material;
}
