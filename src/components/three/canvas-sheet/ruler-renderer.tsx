import { useMemo, useRef, Suspense } from "react";
import { useShallow } from "zustand/react/shallow";
import * as THREE from "three";
import { useThree, useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import { stampToVisualTime } from "@semio/ui";
import { usePlayerStore } from "@semio/utils";
import { useAnimationStore, useAltKeyPressed, usePixelToWorld } from "../../../hooks";
import type { AnimationData } from "../../../store-types";

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
  const { size } = useThree();
  const { pixelsToWorldY, pixelsToWorldX } = usePixelToWorld();
  const frameCount = Math.floor(framerate * (duration / 1000));

  // Refs for tick instances to update their scale
  const tickRefs = useRef<(THREE.Object3D | null)[]>([]);

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

  // Update tick widths based on zoom to maintain 2px visual width
  useFrame(({ camera: frameCamera }) => {
    if (!size.width) return;

    const orthoCamera = frameCamera as THREE.OrthographicCamera;
    const frustumWidth = orthoCamera.right - orthoCamera.left;

    // Calculate how many world units equal 2 pixels
    const pixelsToWorld = frustumWidth / size.width;
    const targetWorldWidth = 2 * pixelsToWorld; // 2 pixels in world units

    // Scale the base width (1 unit) to achieve target width
    const scaleFactorX = targetWorldWidth;

    // Apply scale to all tick instances
    tickRefs.current.forEach((tickRef) => {
      if (tickRef) {
        tickRef.scale.set(scaleFactorX, 1, 1);
      }
    });
  });

  return (
    <group>
      {/* Tick lines using individual meshes */}
      {tickData.map((tick, index) => (
        <mesh
          key={tick.frameIndex}
          position={[tick.worldX, yPosition, 0]}
          ref={(el) => {
            if (el && tickRefs.current) {
              tickRefs.current[index] = el as THREE.Object3D | null;
            }
          }}
        >
          <planeGeometry args={[baseTickWidth, tickHeight]} />
          <meshBasicMaterial color={tickColor as any} toneMapped={false} />
        </mesh>
      ))}

      {/* Time labels */}
      <Suspense fallback={null}>
        <TextBoxes
          ticks={visibleTicks}
          side={side}
          theme={theme}
          yPosition={yPosition}
          tickHeight={tickHeight}
          pixelsToWorldY={pixelsToWorldY}
          pixelsToWorldX={pixelsToWorldX}
        />
      </Suspense>
    </group>
  );
}

// Component for text labels with zoom-invariant scaling
function TextBoxes({
  ticks,
  side,
  theme,
  yPosition,
  tickHeight,
  pixelsToWorldY,
  pixelsToWorldX,
}: {
  ticks: { worldX: number; frameIndex: number; timeLabel: string }[];
  side: "top" | "bottom";
  theme: "light" | "dark";
  yPosition: number;
  tickHeight: number;
  pixelsToWorldY: number;
  pixelsToWorldX: number;
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
    <>
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
            fontSize={baseFontSize}
            color={theme === "dark" ? "#ffffff" : "#000000"}
            anchorX="center"
            anchorY="middle"
            characters="0123456789:.-sf"
          >
            {tick.timeLabel}
          </Text>
        </group>
      ))}
    </>
  );
}
