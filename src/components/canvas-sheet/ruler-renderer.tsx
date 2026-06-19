import { useState, useRef, useMemo, memo, useCallback } from "react";
import { strip } from "number-precision";
import { useShallow } from "zustand/react/shallow";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { stampToVisualTime, Theme, useCanvasContextMenu } from "@semio/ui";
import { usePlayerStore, isOrthographicCamera } from "@semio/utils";
import {
  useAnimationStore,
  useAltKeyPressed,
  usePlaybackGestures,
} from "../../hooks";
import type { AnimationData } from "../../store-types";
import { computeTickIntervals } from "../../functions/compute-tick-interval";
import { Z } from "../../constants";
import { buildRulerMenuItems } from "./context-menus";
import { TrackText } from "./shared/track-text";
import { HoverMarker } from "./overlays/hover-marker";
import { PlayheadCart } from "./overlays/playhead-cart";
import { BoundsCart } from "./overlays/bounds-cart";
import { FrustumBackground } from "./frustum-background";

interface RulerRendererProps {
  height: number;
  side: "top" | "bottom";
  theme?: Theme.Light | Theme.Dark;
  fonts?: {
    mono?: string;
    ui?: string;
  };
}

interface RulerTick {
  worldX: number;
  timeLabel: string;
}

// Helper function for calculating text position relative to tick marks
function calculateTextPosition(
  yPosition: number,
  tickHeight: number,
  side: "top" | "bottom",
  spacingPixels: number,
): number {
  return side === "top"
    ? yPosition + tickHeight / 2 + spacingPixels
    : yPosition - tickHeight / 2 - spacingPixels;
}

// --- Simplified Blender-style shader: just major and minor intervals ---

const rulerTickVertexShader = /* glsl */ `
  varying float vWorldX;
  varying float vLocalY;
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldX = worldPos.x;
    vLocalY = position.y;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const rulerTickFragmentShader = /* glsl */ `
  uniform float uMajorIntervalMs;
  uniform float uMinorIntervalMs;
  uniform float uLabelIntervalMs;
  uniform float uPixelsPerMs;
  uniform vec3 uMajorColor;
  uniform vec3 uMinorColor;
  uniform float uTickWidthPx;

  uniform float uMajorYMin;
  uniform float uMajorYMax;
  uniform float uMinorYMin;
  uniform float uMinorYMax;
  uniform float uMinorOpacity;

  varying float vWorldX;
  varying float vLocalY;

  void main() {
    if (uMajorIntervalMs < 0.001 || uPixelsPerMs < 0.0001) discard;

    float x = vWorldX;
    float y = vLocalY;

    float halfWidth = uTickWidthPx * 0.5;

    // Labeled tick — at the label interval (major interval * decimation frequency)
    float nearestLabel = floor(x / uLabelIntervalMs + 0.5);
    float distLabelPx = abs(x - nearestLabel * uLabelIntervalMs) * uPixelsPerMs;
    float labelHit = (1.0 - smoothstep(halfWidth - 0.5, halfWidth + 0.5, distLabelPx))
                   * step(uMajorYMin, y) * step(y, uMajorYMax);

    // Unlabeled major tick — at major interval, major height, but minor color
    float nearestMajor = floor(x / uMajorIntervalMs + 0.5);
    float distMajorPx = abs(x - nearestMajor * uMajorIntervalMs) * uPixelsPerMs;
    float majorHit = (1.0 - smoothstep(halfWidth - 0.5, halfWidth + 0.5, distMajorPx))
                   * step(uMajorYMin, y) * step(y, uMajorYMax);

    // Minor tick — at minor interval, shorter height
    float minorHit = 0.0;
    if (uMinorIntervalMs > 0.001 && uMinorIntervalMs < uMajorIntervalMs - 0.001) {
      float nearestMinor = floor(x / uMinorIntervalMs + 0.5);
      float distMinorPx = abs(x - nearestMinor * uMinorIntervalMs) * uPixelsPerMs;
      minorHit = (1.0 - smoothstep(halfWidth - 0.5, halfWidth + 0.5, distMinorPx))
               * step(uMinorYMin, y) * step(y, uMinorYMax);
    }

    // Labeled ticks get major color; unlabeled major ticks get minor color
    vec3 color = labelHit > 0.01 ? uMajorColor : uMinorColor;
    float alpha = max(labelHit, max(majorHit * uMinorOpacity, minorHit * uMinorOpacity * (1.0 - majorHit)));

    if (alpha < 0.001) discard;
    gl_FragColor = vec4(color, alpha);
  }
`;

// Minimum pixel spacing for major ticks — must match content area for alignment
const RULER_MIN_MAJOR_PX = 40;
// Approximate character width at 10px font size for label decimation
const APPROX_CHAR_WIDTH = 6;
const LABEL_PADDING_PX = 14;

export const RulerRenderer = memo(function RulerRenderer({
  height,
  side,
  theme = Theme.Light,
  fonts = {},
}: RulerRendererProps) {
  const duration = usePlayerStore(useShallow((state) => state.player.duration));
  const framerate = useAnimationStore(
    useShallow((state: AnimationData) => state.framerate as number),
  );
  const timeDisplay = useAnimationStore(useShallow((state: AnimationData) => state.timeDisplay));
  const setTimeDisplay = useAnimationStore(useShallow((state) => state.setTimeDisplay));
  const altPressed = useAltKeyPressed();

  const playbackGestures = usePlaybackGestures();

  const rulerMenuItems = useCallback(
    (ctx: Parameters<typeof buildRulerMenuItems>[0]) =>
      buildRulerMenuItems(ctx, timeDisplay, setTimeDisplay),
    [timeDisplay, setTimeDisplay],
  );
  const { onContextMenu } = useCanvasContextMenu({
    items: rulerMenuItems,
  });

  // Label state — updated from useFrame only when the visible label set changes.
  // This prevents React re-render churn during continuous pan/zoom.
  const [labelState, setLabelState] = useState<{
    ticks: RulerTick[];
    majorMs: number;
    minorMs: number;
    labelIntervalMs: number;
  }>({ ticks: [], majorMs: 1000, minorMs: 500, labelIntervalMs: 1000 });

  // Track what we last computed so we can detect changes
  const prevLabelKeyRef = useRef("");

  const computeLabels = useCallback(
    (fLeft: number, fRight: number, pxWidth: number) => {
      if (framerate <= 0) return;
      const visibleWidth = fRight - fLeft;
      if (visibleWidth <= 0 || pxWidth <= 0) return;

      const pixelsPerMs = pxWidth / visibleWidth;
      const { majorMs, minorMs } = computeTickIntervals(framerate, pixelsPerMs, RULER_MIN_MAJOR_PX);

      const margin = majorMs * 2;
      const firstTick = Math.floor((fLeft - margin) / majorMs);
      const lastTick = Math.ceil((fRight + margin) / majorMs);

      // Build a key from the parameters that affect the label set.
      // Only update React state when this key changes.
      const labelKey = `${majorMs}:${firstTick}:${lastTick}:${Math.round(pxWidth)}:${timeDisplay}:${altPressed ? "a" : ""}`;
      if (labelKey === prevLabelKeyRef.current) return;
      prevLabelKeyRef.current = labelKey;

      // Label decimation: compute skip frequency from the zoom level (pixels per major tick)
      // and estimated label width. Using zoom level instead of visible tick count ensures
      // stability — small pans don't change drawFrequency and labels don't flicker.
      const sampleStamp = strip(Math.round((firstTick + lastTick) / 2) * majorMs);
      const sampleLabel = stampToVisualTime(sampleStamp, duration, framerate, timeDisplay, altPressed);
      const labelWidthPx = sampleLabel.length * APPROX_CHAR_WIDTH + LABEL_PADDING_PX;
      const pxPerMajorTick = majorMs * pixelsPerMs;
      const drawFrequency = Math.max(1, Math.ceil(labelWidthPx / pxPerMajorTick));

      const decimatedTicks: RulerTick[] = [];
      for (let i = firstTick; i <= lastTick; i++) {
        // Use absolute tick index (relative to 0) for stable decimation
        if (i % drawFrequency !== 0) continue;
        const stampMs = strip(i * majorMs);
        const timeLabel = stampToVisualTime(stampMs, duration, framerate, timeDisplay, altPressed);
        decimatedTicks.push({ worldX: stampMs, timeLabel });
      }

      const labelIntervalMs = majorMs * drawFrequency;
      setLabelState({ ticks: decimatedTicks, majorMs, minorMs, labelIntervalMs });
    },
    [framerate, duration, timeDisplay, altPressed],
  );

  // Read frustum in useFrame (no React subscription) and update labels only when needed
  useFrame(({ camera, size }) => {
    if (!isOrthographicCamera(camera)) return;
    computeLabels(camera.left, camera.right, size.width);
  });

  const { ticks: labelTicks, majorMs, minorMs, labelIntervalMs } = labelState;

  // Tick dimensions
  const majorTickHeightPixels = side === "top" ? 12 : 13;
  const majorTickHeight = majorTickHeightPixels;
  const minorTickHeight = Math.max(6, Math.round(majorTickHeightPixels * 0.7));

  const hudHeightWorld = height;
  const edgeOffset = 1;

  const majorTickYPosition =
    side === "top"
      ? -hudHeightWorld / 2 + majorTickHeight / 2 + edgeOffset
      : hudHeightWorld / 2 - majorTickHeight / 2 - edgeOffset;
  const minorTickYPosition =
    side === "top"
      ? -hudHeightWorld / 2 + minorTickHeight / 2 + edgeOffset
      : hudHeightWorld / 2 - minorTickHeight / 2 - edgeOffset;

  const majorTickColor = new THREE.Color(theme === "dark" ? "#F0F0F0" : "#999999");
  const minorTickColor = new THREE.Color(theme === "dark" ? "#909090" : "#B0B0B0");

  return (
    <>
      <FrustumBackground
        height={hudHeightWorld}
        visibility="transparent"
        z={-0.5}
        pointerEvents={{ ...playbackGestures, onContextMenu }}
      />

      <HoverMarker height={hudHeightWorld} theme={theme} />
      <PlayheadCart
        height={hudHeightWorld}
        theme={theme}
        side={side}
        fonts={fonts}
        // Toggle to compare bottom-cart clamping behavior. When true, the
        // minimap cart is clamped to its own camera frustum so the box stays
        // readable at t=0 / t=duration. When false, the bottom cart sits
        // exactly at the playhead (legacy — can be cropped at endpoints).
        pinToViewport={side === "bottom"}
      />
      <BoundsCart side={side} height={hudHeightWorld} theme={theme} />

      {/* Shader-based tick lines */}
      <RulerTicksShader
        height={hudHeightWorld}
        majorMs={majorMs}
        minorMs={minorMs}
        labelIntervalMs={labelIntervalMs}
        majorColor={majorTickColor}
        minorColor={minorTickColor}
        majorTickYPosition={majorTickYPosition}
        majorTickHeight={majorTickHeight}
        minorTickYPosition={minorTickYPosition}
        minorTickHeight={minorTickHeight}
      />

      {/* Decimated text labels */}
      <TextBoxes
        ticks={labelTicks}
        side={side}
        theme={theme}
        yPosition={majorTickYPosition}
        tickHeight={majorTickHeight}
        fonts={fonts}
      />
    </>
  );
});

// Shader-based ruler ticks — Blender-style major + minor at half-interval
const RulerTicksShader = memo(function RulerTicksShader({
  height,
  majorMs,
  minorMs,
  labelIntervalMs,
  majorColor,
  minorColor,
  majorTickYPosition,
  majorTickHeight,
  minorTickYPosition,
  minorTickHeight,
}: {
  height: number;
  majorMs: number;
  minorMs: number;
  labelIntervalMs: number;
  majorColor: THREE.Color;
  minorColor: THREE.Color;
  majorTickYPosition: number;
  majorTickHeight: number;
  minorTickYPosition: number;
  minorTickHeight: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uMajorIntervalMs: { value: majorMs },
      uMinorIntervalMs: { value: minorMs },
      uLabelIntervalMs: { value: labelIntervalMs },
      uPixelsPerMs: { value: 1 },
      uMajorColor: { value: majorColor },
      uMinorColor: { value: minorColor },
      uTickWidthPx: { value: 1.0 },
      uMajorYMin: { value: majorTickYPosition - majorTickHeight / 2 },
      uMajorYMax: { value: majorTickYPosition + majorTickHeight / 2 },
      uMinorYMin: { value: minorTickYPosition - minorTickHeight / 2 },
      uMinorYMax: { value: minorTickYPosition + minorTickHeight / 2 },
      uMinorOpacity: { value: 0.7 },
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

    const mat = materialRef.current;
    mat.uniforms.uMajorIntervalMs.value = majorMs;
    mat.uniforms.uMinorIntervalMs.value = minorMs;
    mat.uniforms.uLabelIntervalMs.value = labelIntervalMs;
    mat.uniforms.uPixelsPerMs.value = size.width / frustumWidth;
    mat.uniforms.uMajorColor.value = majorColor;
    mat.uniforms.uMinorColor.value = minorColor;
    mat.uniforms.uMajorYMin.value = majorTickYPosition - majorTickHeight / 2;
    mat.uniforms.uMajorYMax.value = majorTickYPosition + majorTickHeight / 2;
    mat.uniforms.uMinorYMin.value = minorTickYPosition - minorTickHeight / 2;
    mat.uniforms.uMinorYMax.value = minorTickYPosition + minorTickHeight / 2;
  });

  return (
    <mesh ref={meshRef} position={[0, 0, 0]}>
      <planeGeometry args={[1, height]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={rulerTickVertexShader}
        fragmentShader={rulerTickFragmentShader}
        uniforms={uniforms}
        transparent
        toneMapped={false}
        depthWrite={false}
      />
    </mesh>
  );
});

// Text labels keyed by world position — labels at the same ms position
// persist across updates, preventing mount/unmount flicker.
const TextBoxes = memo(function TextBoxes({
  ticks,
  side,
  theme,
  yPosition,
  tickHeight,
  fonts,
}: {
  ticks: RulerTick[];
  side: "top" | "bottom";
  theme: "light" | "dark";
  yPosition: number;
  tickHeight: number;
  fonts?: {
    mono?: string;
    ui?: string;
  };
}) {
  const textYWorld = calculateTextPosition(yPosition, tickHeight, side, 6);
  const color = theme === "dark" ? "#ffffff" : "#000000";

  return (
    <>
      {ticks.map((tick) => (
        <TrackText
          key={tick.worldX}
          text={tick.timeLabel}
          position={[tick.worldX, textYWorld, Z.RulerText]}
          color={color}
          font={fonts?.mono}
          fontSizePixels={10}
          anchorX="center"
          anchorY="middle"
          characters="0123456789:.-sfm"
          name={`ruler-text-${tick.worldX.toString()}`}
        />
      ))}
    </>
  );
});
