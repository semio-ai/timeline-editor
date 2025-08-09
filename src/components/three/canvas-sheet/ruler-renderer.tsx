import { useMemo, useRef, Suspense, memo } from "react";
import { useShallow } from "zustand/react/shallow";
import * as THREE from "three";
import { useThree, useFrame } from "@react-three/fiber";
import { Instances, Instance, Text } from "@react-three/drei";
import { stampToVisualTime } from "@semio/ui";
import { usePlayerStore } from "@semio/utils";
import { useAnimationStore, useAltKeyPressed, usePixelToWorld } from "../../../hooks";
import type { AnimationData } from "../../../store-types";
import { AnimatedIn } from "../utilities/animated-in";

interface RulerRendererProps {
  height: number;
  side: "top" | "bottom";
  theme?: "light" | "dark";
  fonts?: {
    mono?: string;
    ui?: string;
  };
}

// Helper function for calculating text position relative to tick marks
function calculateTextPosition(
  yPosition: number,
  tickHeight: number,
  side: "top" | "bottom",
  spacingPixels: number,
  pixelsToWorldY: number,
): number {
  const spacingWorld = spacingPixels * pixelsToWorldY;
  return side === "top"
    ? yPosition + tickHeight / 2 + spacingWorld
    : yPosition - tickHeight / 2 - spacingWorld;
}

export function RulerRenderer({ height, side, theme = "light", fonts = {} }: RulerRendererProps) {
  const duration = usePlayerStore(useShallow((state) => state.player.duration));
  const framerate = useAnimationStore(
    useShallow((state: AnimationData) => state.framerate as number),
  );
  const [timeDisplay] = useAnimationStore(
    useShallow((state: AnimationData) => [state.timeDisplay]),
  );
  const altPressed = useAltKeyPressed();
  const { pixelsToWorldY, pixelsToWorldX } = usePixelToWorld();
  const frameCount = Math.floor(framerate * (duration / 1000));

  // Generate tick data - only major ticks for ruler (every second)
  const tickData = useMemo(() => {
    const majorTicks = [];
    for (let i = 0; i <= frameCount; i += framerate) {
      const stamp = i / frameCount;
      const worldX = stamp;
      const timeLabel = stampToVisualTime(stamp, duration, framerate, timeDisplay, altPressed);

      majorTicks.push({
        worldX,
        stamp,
        timeLabel,
        frameIndex: i,
      });
    }
    return majorTicks;
  }, [frameCount, framerate, duration, timeDisplay, altPressed]);

  // Calculate tick dimensions - convert pixel heights to world units

  // Set tick heights in pixels, then convert to world units
  const tickHeightPixels = side === "top" ? 12 : 13;
  const tickHeight = tickHeightPixels * pixelsToWorldY;
  const baseTickWidth = 1; // Base width of 1 unit that will be scaled down

  // Position ticks at the edge of the HUD
  // HUD height in world units
  const hudHeightWorld = height * pixelsToWorldY;

  // Top HUD: position at bottom edge (1px above bottom)
  // Bottom HUD: position at top edge (0px below top)
  const edgeOffset = side === "top" ? pixelsToWorldY : 0;
  const yPosition =
    side === "top"
      ? -hudHeightWorld / 2 + tickHeight / 2 + edgeOffset
      : hudHeightWorld / 2 - tickHeight / 2 - edgeOffset;

  const tickColor = new THREE.Color(theme === "dark" ? "#737373" : "#737373");

  // Use all ticks since HudSection handles viewport management
  const visibleTicks = tickData;

  return (
    <>
      {/* Tick lines using Instances */}
      <AnimatedIn from={{ opacity: 0 }} to={{ opacity: 1 }} duration={1} delay={1}>
        <Ticks
          tickData={tickData}
          tickHeight={tickHeight}
          baseTickWidth={baseTickWidth}
          tickColor={tickColor}
          yPosition={yPosition}
        />
      </AnimatedIn>

      {/* Time labels */}
      <AnimatedIn from={{ opacity: 0 }} to={{ opacity: 1 }} duration={1} delay={1.2}>
        <TextBoxes
          ticks={visibleTicks}
          side={side}
          theme={theme}
          yPosition={yPosition}
          tickHeight={tickHeight}
          pixelsToWorldY={pixelsToWorldY}
          pixelsToWorldX={pixelsToWorldX}
          fonts={fonts}
        />
      </AnimatedIn>
    </>
  );
}

function InnerTicks({
  tickData,
  tickHeight,
  baseTickWidth,
  tickColor,
  yPosition,
}: {
  tickData: { worldX: number; frameIndex: number; timeLabel: string }[];
  tickHeight: number;
  baseTickWidth: number;
  tickColor: string | THREE.Color;
  yPosition: number;
}) {
  return (
    <Instances>
      <planeGeometry args={[baseTickWidth, tickHeight]} />
      <meshBasicMaterial color={tickColor as any} toneMapped={false} transparent />

      {tickData.map((tick) => (
        <TickMark
          key={tick.frameIndex}
          position={[tick.worldX, yPosition, 0]}
          baseTickWidth={baseTickWidth}
        />
      ))}
    </Instances>
  );
}

const Ticks = memo(InnerTicks);

// Component for text labels with zoom-invariant scaling
function TextBoxes({
  ticks,
  side,
  theme,
  yPosition,
  tickHeight,
  pixelsToWorldY,
  fonts,
}: {
  ticks: { worldX: number; frameIndex: number; timeLabel: string }[];
  side: "top" | "bottom";
  theme: "light" | "dark";
  yPosition: number;
  tickHeight: number;
  pixelsToWorldY: number;
  pixelsToWorldX: number;
  fonts?: {
    mono?: string;
    ui?: string;
  };
}) {
  const { size } = useThree();
  const textRefs = useRef<(THREE.Object3D | null)[]>([]);

  // Initialize textRefs array to match ticks length
  useMemo(() => {
    textRefs.current = new Array(ticks.length).fill(null);
  }, [ticks.length]);

  // Calculate text position using helper function
  const textYWorld = calculateTextPosition(yPosition, tickHeight, side, 6, pixelsToWorldY);

  // Text scaling constants
  const fontSizePixels = 10;
  const baseFontSize = 0.01;

  // Update text scales to maintain constant pixel size regardless of zoom
  useFrame(({ camera: frameCamera }) => {
    if (!size.width || !size.height) return;

    const orthoCamera = frameCamera as THREE.OrthographicCamera;
    const currentFrustumHeight = orthoCamera.top - orthoCamera.bottom;
    const currentFrustumWidth = orthoCamera.right - orthoCamera.left;

    // Calculate scale factors for both axes
    const currentPixelsToWorldY = currentFrustumHeight / size.height;
    const currentPixelsToWorldX = currentFrustumWidth / size.width;
    const fontScaleFactorY = (fontSizePixels * currentPixelsToWorldY) / baseFontSize;
    const fontScaleFactorX = (fontSizePixels * currentPixelsToWorldX) / baseFontSize;

    // Apply scaling to all text instances
    textRefs.current.forEach((textRef) => {
      if (textRef) {
        textRef.scale.set(fontScaleFactorX, fontScaleFactorY, 1);
      }
    });
  });

  return (
    <Suspense fallback={null}>
      {ticks.map((tick, index) => (
        <group
          key={`label-${tick.frameIndex.toString()}`}
          position={[tick.worldX, textYWorld, 0.002]}
          ref={(el) => {
            if (el && textRefs.current) {
              textRefs.current[index] = el as THREE.Object3D | null;
            }
          }}
        >
          <Text
            font={fonts?.mono}
            fontSize={baseFontSize}
            color={theme === "dark" ? "#ffffff" : "#000000"}
            anchorX="center"
            anchorY="middle"
            characters="0123456789:.-sf"
            material-transparent
          >
            {tick.timeLabel}
          </Text>
        </group>
      ))}
    </Suspense>
  );
}

// Component for individual tick marks with zoom-invariant scaling
function TickMark({
  position,
  baseTickWidth,
}: {
  position: [number, number, number];
  baseTickWidth: number;
}) {
  const { size } = useThree();
  const tickRef = useRef<THREE.Object3D>(null);

  // Update tick width based on zoom to maintain 2px visual width
  useFrame(({ camera }) => {
    if (!size.width || !tickRef.current) return;

    const orthoCamera = camera as THREE.OrthographicCamera;
    const frustumWidth = orthoCamera.right - orthoCamera.left;

    // Calculate how many world units equal 2 pixels
    const pixelsToWorld = frustumWidth / size.width;
    const targetWorldWidth = 2 * pixelsToWorld; // 2 pixels in world units

    // Scale the base width (1 unit) to achieve target width
    const scaleFactorX = targetWorldWidth / baseTickWidth;

    tickRef.current.scale.set(scaleFactorX, 1, 1);
  });

  return <Instance ref={tickRef} position={position} />;
}
