import { useMemo, useRef, Suspense, RefObject } from "react";
import { useShallow } from "zustand/react/shallow";
import * as THREE from "three";
import { useThree, useFrame } from "@react-three/fiber";
import { Instances, Instance, Text } from "@react-three/drei";
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

export function RulerRenderer(props: RulerRendererProps) {
  const { height, side, theme = "light", fonts = {} } = props;

  const instanceRefs = useRef<THREE.Object3D[]>([]);
  const labelRefs = useRef<THREE.Object3D[]>([]);

  const duration = usePlayerStore(useShallow((state) => state.player.duration));
  const framerate = useAnimationStore(
    useShallow((state: AnimationData) => state.framerate as number),
  );
  const [timeDisplay] = useAnimationStore(
    useShallow((state: AnimationData) => [state.timeDisplay]),
  );
  const altPressed = useAltKeyPressed();
  const { pixelsToWorldY } = usePixelToWorld();
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
  const tickHeightPixels = side === "top" ? 12 : 13;
  const tickHeight = tickHeightPixels * pixelsToWorldY;
  const baseTickWidth = 1; // Base width of 1 unit that will be scaled down

  // Position ticks at the edge of the HUD
  const hudHeightWorld = height * pixelsToWorldY;
  const edgeOffset = side === "top" ? pixelsToWorldY : 0;
  const yPosition =
    side === "top"
      ? -hudHeightWorld / 2 + tickHeight / 2 + edgeOffset
      : hudHeightWorld / 2 - tickHeight / 2 - edgeOffset;

  const tickColor = new THREE.Color(theme === "dark" ? "#737373" : "#737373");

  const { size } = useThree();
  useTickLabelScaling(size, tickHeight, baseTickWidth, pixelsToWorldY, instanceRefs, labelRefs);

  return (
    <group>
      <Instances>
        <planeGeometry args={[baseTickWidth, tickHeight]} />
        <meshBasicMaterial color={tickColor as any} toneMapped={false} />
        {tickData.map((tick, idx) => (
          <Instance
            key={tick.frameIndex}
            position={[tick.worldX, yPosition, 0]}
            ref={(el) => {
              if (el && instanceRefs.current) {
                instanceRefs.current[idx] = el as THREE.Object3D;
              }
            }}
          >
            <Suspense fallback={null}>
              <group
                ref={(el) => {
                  if (el && labelRefs.current) {
                    labelRefs.current[idx] = el as THREE.Object3D;
                  }
                }}
                position={[0, calculateTextPosition(0, tickHeight, side, 6, pixelsToWorldY), 0.002]}
              >
                <Text
                  font={fonts?.mono}
                  fontSize={baseFontSize}
                  color={theme === "dark" ? "#ffffff" : "#000000"}
                  anchorX="center"
                  anchorY="middle"
                  characters="0123456789:.-sf"
                >
                  {tick.timeLabel}
                </Text>
              </group>
            </Suspense>
          </Instance>
        ))}
      </Instances>
    </group>
  );
}

const fontSizePixels = 10;
const baseFontSize = 0.01;

function useTickLabelScaling(
  size: { width: number; height: number },
  tickHeight: number,
  baseTickWidth: number,
  pixelsToWorldY: number,
  instanceRefs: RefObject<THREE.Object3D[]>,
  labelRefs: RefObject<THREE.Object3D[]>,
) {
  useFrame(({ camera }) => {
    if (!size.width || !size.height) return;
    const orthoCamera = camera as THREE.OrthographicCamera;
    const frustumHeight = orthoCamera.top - orthoCamera.bottom;
    const frustumWidth = orthoCamera.right - orthoCamera.left;

    // Tick scaling: maintain 2px width
    instanceRefs.current?.forEach((tickRef) => {
      if (tickRef) {
        const pixelsToWorld = frustumWidth / size.width;
        const targetWorldWidth = 2 * pixelsToWorld;
        const scaleFactorX = targetWorldWidth / baseTickWidth;
        tickRef.scale.set(scaleFactorX, 1, 1);
      }
    });

    // Text scaling: maintain constant pixel size
    labelRefs.current?.forEach((textRef) => {
      if (textRef) {
        const currentPixelsToWorldY = frustumHeight / size.height;
        const currentPixelsToWorldX = frustumWidth / size.width;
        const fontScaleFactorY = (fontSizePixels * currentPixelsToWorldY) / baseFontSize;
        const fontScaleFactorX = (fontSizePixels * currentPixelsToWorldX) / baseFontSize;
        textRef.scale.set(fontScaleFactorX, fontScaleFactorY, 1);
      }
    });
  });
}
