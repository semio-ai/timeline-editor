import { useMemo, useRef, memo, useEffect } from "react";
import { strip } from "number-precision";
import { useShallow } from "zustand/react/shallow";
import * as THREE from "three";
import { Instances, Instance } from "@react-three/drei";
import { useMotionValueEvent } from "motion/react";
import { stampToVisualTime, Theme } from "@semio/ui";
import { usePlayerStore } from "@semio/utils";
import {
  useAnimationStore,
  useAltKeyPressed,
  usePlaybackGestures,
  useInvariantScale,
} from "../../hooks";
import type { AnimationData } from "../../store-types";
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
  const frameCount = Math.floor(framerate * (duration / 1000));

  // Add playback gestures for seeking and hover preview
  const playbackGestures = usePlaybackGestures();

  // Generate major (labeled) and minor (unlabeled) ticks for the ruler.
  const { majorTicks, minorTicks } = useMemo(() => {
    if (!Number.isFinite(frameCount) || frameCount <= 0 || framerate <= 0) {
      return { majorTicks: [], minorTicks: [] };
    }

    const major: RulerTick[] = [];
    for (let i = 0; i <= frameCount; i += framerate) {
      const stamp = i / frameCount;
      const worldX = stamp;
      const timeLabel = stampToVisualTime(stamp, duration, framerate, timeDisplay, altPressed);

      major.push({
        worldX,
        timeLabel,
        frameIndex: i,
      });
    }

    // Minor ticks follow timeline background rules: every non-major frame.
    const minor: RulerTick[] = [];
    for (let i = 0; i <= frameCount; i += 1) {
      if (i % framerate === 0) continue;
      minor.push({
        worldX: strip(i / frameCount),
        frameIndex: i,
      });
    }

    return { majorTicks: major, minorTicks: minor };
  }, [frameCount, framerate, duration, timeDisplay, altPressed]);

  // Calculate tick dimensions - convert pixel heights to world units

  // Set tick heights in pixels, then convert to world units
  const majorTickHeightPixels = side === "top" ? 12 : 13;
  const majorTickHeight = majorTickHeightPixels;
  const minorTickHeight = Math.max(6, Math.round(majorTickHeightPixels * 0.7));
  const baseTickWidth = 1; // Base width of 1 unit that will be scaled down

  // Position ticks at the edge of the HUD
  // HUD height in world units
  const hudHeightWorld = height;

  // Top HUD: position at bottom edge (1px above bottom)
  // Bottom HUD: position at top edge (0px below top)
  const edgeOffset = 1;
  const majorTickYPosition =
    side === "top"
      ? -hudHeightWorld / 2 + majorTickHeight / 2 + edgeOffset
      : hudHeightWorld / 2 - majorTickHeight / 2 - edgeOffset;
  const minorTickYPosition =
    side === "top"
      ? -hudHeightWorld / 2 + minorTickHeight / 2 + edgeOffset
      : hudHeightWorld / 2 - minorTickHeight / 2 - edgeOffset;

  const majorTickColor = new THREE.Color(theme === "dark" ? "#737373" : "#737373");
  const minorTickColor = majorTickColor;

  // Use all major ticks for text labels since HudSection handles viewport management.
  const visibleTicks = majorTicks;

  return (
    <>
      {/* Background gesture plane for playback interactions */}
      <FrustumBackground
        height={hudHeightWorld}
        visibility="transparent"
        z={-0.5}
        pointerEvents={playbackGestures}
      />

      <HoverMarker height={hudHeightWorld} theme={theme} />
      <PlayheadCart height={hudHeightWorld} theme={theme} side={side} fonts={fonts} />
      <BoundsCart side={side} height={hudHeightWorld} theme={theme} />

      {/* Tick lines using Instances */}
      <Ticks
        tickData={minorTicks}
        tickHeight={minorTickHeight}
        baseTickWidth={baseTickWidth}
        tickColor={minorTickColor}
        tickOpacity={0.5}
        instanceKey="minor"
        yPosition={minorTickYPosition}
      />
      <Ticks
        tickData={majorTicks}
        tickHeight={majorTickHeight}
        baseTickWidth={baseTickWidth}
        tickColor={majorTickColor}
        tickOpacity={1}
        instanceKey="major"
        yPosition={majorTickYPosition}
      />

      {/* Time labels */}
      <TextBoxes
        ticks={visibleTicks}
        side={side}
        theme={theme}
        yPosition={majorTickYPosition}
        tickHeight={majorTickHeight}
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
  tickOpacity,
  instanceKey,
  yPosition,
}: {
  tickData: RulerTick[];
  tickHeight: number;
  baseTickWidth: number;
  tickColor: string | THREE.Color;
  tickOpacity: number;
  instanceKey: string;
  yPosition: number;
}) {
  const instanceCount = tickData.length;

  if (instanceCount === 0) return null;

  return (
    <Instances
      key={`ruler-ticks-${instanceKey}-${instanceCount.toString()}`}
      limit={instanceCount}
      range={instanceCount}
    >
      <planeGeometry args={[baseTickWidth, tickHeight]} />
      <meshBasicMaterial
        color={tickColor as any}
        toneMapped={false}
        transparent={tickOpacity < 1}
        opacity={tickOpacity}
      />

      {tickData.map((tick) => (
        <TickMark
          key={`${tick.frameIndex.toString()}-${tick.worldX.toString()}`}
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
  // Calculate text position using helper function
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

  useMotionValueEvent(scaleX, "change", (s) => {
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
