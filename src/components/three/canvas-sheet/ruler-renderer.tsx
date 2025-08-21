import { useMemo, useRef, memo, useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import * as THREE from "three";
import { Instances, Instance } from "@react-three/drei";
import { stampToVisualTime, Theme } from "@semio/ui";
import { usePlayerStore } from "@semio/utils";
import {
  useAnimationStore,
  useAltKeyPressed,
  usePixelToWorld,
  usePlaybackGestures,
  useInvariantScale,
} from "../../../hooks";
import type { AnimationData } from "../../../store-types";
import { TrackText } from "./shared/track-text";
import { HoverMarker } from "./overlays/hover-marker";
import { PlayheadCart } from "./overlays/playhead-cart";
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
  const { pixelsToWorldY, pixelsToWorldX } = usePixelToWorld();
  const frameCount = Math.floor(framerate * (duration / 1000));

  // Add playback gestures for seeking and hover preview
  const playbackGestures = usePlaybackGestures();

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
      {/* Background gesture plane for playback interactions */}
      <FrustumBackground
        height={hudHeightWorld}
        opacity={0}
        position={[0.5, 0, -0.5]}
        pointerEvents={playbackGestures}
      />

      <HoverMarker height={hudHeightWorld} theme={theme} />
      <PlayheadCart
        height={hudHeightWorld / pixelsToWorldY}
        theme={theme}
        side={side}
        fonts={fonts}
      />

      {/* Tick lines using Instances */}
      <Ticks
        tickData={tickData}
        tickHeight={tickHeight}
        baseTickWidth={baseTickWidth}
        tickColor={tickColor}
        yPosition={yPosition}
      />

      {/* Time labels */}
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
    </>
  );
});

const Ticks = memo(function Ticks({
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
});

// Component for text labels using shared TrackText
const TextBoxes = memo(function TextBoxes({
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
  // Calculate text position using helper function
  const textYWorld = calculateTextPosition(yPosition, tickHeight, side, 6, pixelsToWorldY);

  return (
    <>
      {ticks.map((tick) => (
        <TrackText
          key={`label-${tick.frameIndex.toString()}`}
          text={tick.timeLabel}
          position={[tick.worldX, textYWorld, 0.002]}
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

// Component for individual tick marks with zoom-invariant scaling
const TickMark = memo(function TickMark({
  position,
  baseTickWidth,
}: {
  position: [number, number, number];
  baseTickWidth: number;
}) {
  const tickRef = useRef<THREE.Object3D>(null);

  const scaleX = useInvariantScale();

  scaleX.on("change", (s) => {
    if (tickRef.current) {
      tickRef.current.scale.set(s * baseTickWidth, 1, 1);
    }
  });

  useEffect(() => {
    if (tickRef.current) {
      tickRef.current.scale.set(scaleX.get() * baseTickWidth, 1, 1);
    }
  }, [baseTickWidth, scaleX]);

  return <Instance ref={tickRef} position={position} />;
});
