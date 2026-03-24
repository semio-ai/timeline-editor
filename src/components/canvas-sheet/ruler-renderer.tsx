import { useMemo, useRef, memo } from "react";
import { strip } from "number-precision";
import { useShallow } from "zustand/react/shallow";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { stampToVisualTime, Theme } from "@semio/ui";
import { usePlayerStore, isOrthographicCamera } from "@semio/utils";
import {
  useAnimationStore,
  useAltKeyPressed,
  usePlaybackGestures,
  useInvariantScale,
} from "../../hooks";
import type { AnimationData } from "../../store-types";
import { useMotionCanvas } from "./shared/motion-canvas-context";
import { Z } from "../../constants";
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
  frameIndex: number;
  timeLabel?: string;
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

// --- Shader-based ruler ticks ---

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
  uniform float uFrameDurationMs;
  uniform float uFramerate;
  uniform float uLabelIntervalMs;
  uniform float uPixelsPerMs;
  uniform vec3 uMajorColor;
  uniform vec3 uMinorColor;
  uniform float uTickWidthPx;

  // Tick region in local Y: ticks are drawn within [yMin, yMax]
  uniform float uMajorYMin;
  uniform float uMajorYMax;
  uniform float uMinorYMin;
  uniform float uMinorYMax;
  uniform float uMinorOpacity;

  varying float vWorldX;
  varying float vLocalY;

  void main() {
    if (uFrameDurationMs < 0.001 || uPixelsPerMs < 0.0001) discard;

    float x = vWorldX;
    float y = vLocalY;

    float pixelsPerFrame = uPixelsPerMs * uFrameDurationMs;

    // Distance to nearest frame boundary (ms)
    float nearestFrame = floor(x / uFrameDurationMs + 0.5);
    float distToFrame = abs(x - nearestFrame * uFrameDurationMs);

    // Distance to nearest label-interval boundary (adaptive major ticks)
    float nearestLabel = floor(x / uLabelIntervalMs + 0.5);
    float distToLabel = abs(x - nearestLabel * uLabelIntervalMs);

    // Pixel distances
    float distToFramePx = distToFrame * uPixelsPerMs;
    float distToLabelPx = distToLabel * uPixelsPerMs;

    float halfWidth = uTickWidthPx * 0.5;

    // Major tick: at label interval boundaries, full height, always visible
    float majorHit = (1.0 - smoothstep(halfWidth - 0.5, halfWidth + 0.5, distToLabelPx))
                   * step(uMajorYMin, y) * step(y, uMajorYMax);

    // Minor tick: per-frame, shorter region, fades at high density
    float minorFade = smoothstep(2.0, 6.0, pixelsPerFrame);
    float minorHit = (1.0 - smoothstep(halfWidth - 0.5, halfWidth + 0.5, distToFramePx))
                   * step(uMinorYMin, y) * step(y, uMinorYMax)
                   * minorFade;

    // Major takes priority
    vec3 color = majorHit > 0.01 ? uMajorColor : uMinorColor;
    float alpha = max(majorHit, minorHit * uMinorOpacity * (1.0 - majorHit));

    if (alpha < 0.001) discard;

    gl_FragColor = vec4(color, alpha);
  }
`;

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
  const altPressed = useAltKeyPressed();
  const { frustum, size: canvasSize } = useMotionCanvas();

  const playbackGestures = usePlaybackGestures();

  const frameDurationMs = framerate > 0 ? 1000 / framerate : 1000;

  // Read the ruler's own camera frustum (works for both dynamic and fixed HUD cameras)
  const frustumLeft = frustum.left.get();
  const frustumRight = frustum.right.get();
  const pixelWidth = canvasSize.width.get() || 800;

  // Adaptive label generation: pick label interval based on this ruler's visible range
  const { labelTicks, labelIntervalMs } = useMemo(() => {
    if (framerate <= 0) return { labelTicks: [] as RulerTick[], labelIntervalMs: 1000 };

    const visibleWidth = frustumRight - frustumLeft;
    if (visibleWidth <= 0) return { labelTicks: [] as RulerTick[], labelIntervalMs: 1000 };

    // Minimum spacing in ms so labels don't overlap (~70px worth)
    const minLabelSpacingMs = (visibleWidth / pixelWidth) * 70;

    // Candidate intervals from coarse to fine
    const candidates = [
      60000, 30000, 10000, 5000, 2000, 1000,
      500, 250,
      frameDurationMs, // per-frame labels at max zoom
    ].filter((c) => c > 0);

    // Pick the smallest interval that still gives enough spacing
    let chosenInterval = candidates[0];
    for (const candidate of candidates) {
      if (candidate >= minLabelSpacingMs) {
        chosenInterval = candidate;
      } else {
        break;
      }
    }

    const margin = chosenInterval * 2;
    const visibleLeft = frustumLeft - margin;
    const visibleRight = frustumRight + margin;

    const firstTick = Math.floor(visibleLeft / chosenInterval);
    const lastTick = Math.ceil(visibleRight / chosenInterval);

    const ticks: RulerTick[] = [];
    for (let i = firstTick; i <= lastTick; i++) {
      const stampMs = strip(i * chosenInterval);
      const timeLabel = stampToVisualTime(stampMs, duration, framerate, timeDisplay, altPressed);
      ticks.push({ worldX: stampMs, timeLabel, frameIndex: i });
    }
    return { labelTicks: ticks, labelIntervalMs: chosenInterval };
  }, [frustumLeft, frustumRight, pixelWidth, framerate, frameDurationMs, duration, timeDisplay, altPressed]);

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
        pointerEvents={playbackGestures}
      />

      <HoverMarker height={hudHeightWorld} theme={theme} />
      <PlayheadCart height={hudHeightWorld} theme={theme} side={side} fonts={fonts} />
      <BoundsCart side={side} height={hudHeightWorld} theme={theme} />

      {/* Shader-based tick lines */}
      <RulerTicksShader
        height={hudHeightWorld}
        frameDurationMs={frameDurationMs}
        framerate={framerate}
        labelIntervalMs={labelIntervalMs}
        majorColor={majorTickColor}
        minorColor={minorTickColor}
        majorTickYPosition={majorTickYPosition}
        majorTickHeight={majorTickHeight}
        minorTickYPosition={minorTickYPosition}
        minorTickHeight={minorTickHeight}
      />

      {/* Time labels — adaptive density based on zoom */}
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

// Shader-based ruler ticks — single quad, GPU-computed
const RulerTicksShader = memo(function RulerTicksShader({
  height,
  frameDurationMs,
  framerate,
  labelIntervalMs,
  majorColor,
  minorColor,
  majorTickYPosition,
  majorTickHeight,
  minorTickYPosition,
  minorTickHeight,
}: {
  height: number;
  frameDurationMs: number;
  framerate: number;
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
      uFrameDurationMs: { value: frameDurationMs },
      uFramerate: { value: framerate },
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

    const frustumLeft = camera.left;
    const frustumRight = camera.right;
    const frustumWidth = frustumRight - frustumLeft;
    if (frustumWidth <= 0 || size.width <= 0) return;
    const center = (frustumLeft + frustumRight) / 2;

    meshRef.current.position.x = center;
    meshRef.current.scale.x = frustumWidth;

    const mat = materialRef.current;
    mat.uniforms.uFrameDurationMs.value = frameDurationMs;
    mat.uniforms.uFramerate.value = framerate;
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

// Component for text labels using shared TrackText
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

  return (
    <>
      {ticks.map((tick) => (
        <TrackText
          key={`label-${tick.frameIndex.toString()}`}
          text={tick.timeLabel ?? ""}
          position={[tick.worldX, textYWorld, Z.RulerText]}
          color={theme === "dark" ? "#ffffff" : "#000000"}
          font={fonts?.mono}
          fontSizePixels={10}
          anchorX="center"
          anchorY="middle"
          characters="0123456789:.-sf"
          name={`ruler-text-${tick.frameIndex.toString()}`}
        />
      ))}
    </>
  );
});
