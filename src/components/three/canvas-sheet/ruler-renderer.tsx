import { useMemo, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { Instances, Instance } from "@react-three/drei";
import * as THREE from "three";
import { stampToVisualTime } from "@semio/ui";
import { useShallow } from "zustand/react/shallow";
import { usePlayerStore } from "@semio/utils";
import { useAnimationStore, useAltKeyPressed } from "../../../hooks";
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

export function RulerRenderer({ height, side, theme = "light", fonts = {} }: RulerRendererProps) {
  const duration = usePlayerStore(useShallow((state) => state.player.duration));
  const framerate = useAnimationStore(
    useShallow((state: AnimationData) => state.framerate as number),
  );
  const [timeDisplay] = useAnimationStore(
    useShallow((state: AnimationData) => [state.timeDisplay]),
  );
  const altPressed = useAltKeyPressed();
  const { camera, size, viewport } = useThree();
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
  // We need to convert HUD pixel space to world units
  const orthoCamera = camera as THREE.OrthographicCamera;
  const frustumHeight = orthoCamera.top - orthoCamera.bottom;
  const pixelsToWorldY = frustumHeight / size.height;

  // Set tick heights in pixels, then convert to world units
  const tickHeightPixels = side === "top" ? 12 : 13;
  const tickHeight = tickHeightPixels * pixelsToWorldY;
  const baseTickWidth = 1; // Base width of 1 unit that will be scaled down

  // Position ticks at the edge of the HUD
  // HUD height in world units
  const hudHeightWorld = height * pixelsToWorldY;

  // Top HUD: position at bottom edge (1px above bottom)
  // Bottom HUD: position at top edge (0px below top)
  const edgeOffset = side === "top" ? 1 * pixelsToWorldY : 0;
  const yPosition =
    side === "top"
      ? -hudHeightWorld / 2 + tickHeight / 2 + edgeOffset
      : hudHeightWorld / 2 - tickHeight / 2 - edgeOffset;

  const tickColor = new THREE.Color(theme === "dark" ? "#737373" : "#737373");

  // Use all ticks since HudSection handles viewport management
  const visibleTicks = tickData;

  // Determine font with fallback
  const fontPath = fonts.mono || undefined; // Let drei use system default if undefined

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
      {/* Tick lines using Instances - render immediately */}
      <Instances limit={tickData.length} range={tickData.length}>
        <planeGeometry args={[baseTickWidth, tickHeight]} />
        <meshBasicMaterial color={tickColor as any} toneMapped={false} />

        {tickData.map((tick, index) => (
          <Instance
            key={tick.frameIndex}
            position={[tick.worldX, yPosition, 0]}
            ref={(el) => {
              if (el && tickRefs.current) {
                tickRefs.current[index] = el as THREE.Object3D | null;
              }
            }}
          />
        ))}
      </Instances>

      {/* Time labels - commented out for now due to white area issues */}
      {/* <Suspense fallback={null}>
        {visibleTicks.map((tick) => (
          <Text
            key={`label-${tick.frameIndex.toString()}`}
            position={[tick.worldX, 0, 0.001]}
            fontSize={0.01}
            color={theme === "dark" ? "#ffffff" : "#000000"}
            anchorX="center"
            anchorY="middle"
            font={fontPath}
            characters="0123456789:.-s"
          >
            {tick.timeLabel}
          </Text>
        ))}
      </Suspense> */}
    </group>
  );
}
