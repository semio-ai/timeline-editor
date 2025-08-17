import { memo, useMemo, useEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { useShallow } from "zustand/shallow";
import * as THREE from "three";
import { Theme, TooltipHost } from "@semio/ui";
import { MotionValue, useMotionValue } from "motion/react";
import { usePlayerStore } from "@semio/utils";
import { AnimationInstanceSettings, TrackRender } from "../../../types";
import { PanZoomControls } from "../controls/pan-zoom-controls";
import { calculatePaddedFrustum } from "../../../viewport-utils";
import { HudSection } from "./hud-section";
import { DataRenderer } from "./data-renderer";
import { RulerRenderer } from "./ruler-renderer";
import { TrackList } from "./track-list";
import { MinimapDisplay } from "./minimap-display";

export interface CanvasSheetProps {
  animationId: string; // Unique ID for the animation
  namespaceId: string; // Namespace for the animation, used for scoping
  instanceSettings: AnimationInstanceSettings; // Settings for the animation instance
  tracks?: string[];
  selection?: string[];
  scrollValue?: MotionValue<number>;
  theme?: Theme.Dark | Theme.Light;
  emphasis: string[];
  onEmphasisChange?: (id: string, opt: "add" | "remove") => void;
  fonts?: {
    mono?: string; // Path to monospace font, falls back to system default
    ui?: string; // Path to UI font, falls back to system default
  };
  trackRender?: TrackRender; // Render mode for tracks, e.g. Key, Transition, Preview, Curve, etc.
}

export const CanvasSheet = memo(function CanvasSheet({
  animationId,
  namespaceId,
  instanceSettings = { timescale: 1, offset: 0, active: true },
  tracks = [],
  selection = [],
  scrollValue,
  theme = Theme.Light,
  emphasis = [],
  onEmphasisChange = () => {},
  fonts = {},
  trackRender = TrackRender.Key,
}: CanvasSheetProps) {
  // Get initial viewport from player store to prevent camera bounds flash
  const initialViewport = usePlayerStore(useShallow((state) => state.player.viewport));

  // Calculate initial camera bounds with proper padding to match final state
  // Use a reasonable fallback width if canvas isn't measured yet
  const estimatedCanvasWidth = 800; // Reasonable fallback for initial render
  const { left: initialLeft, right: initialRight } = calculatePaddedFrustum(
    initialViewport,
    estimatedCanvasWidth,
    false, // Dynamic camera follows viewport
  );

  return (
    <TooltipHost className="w-full h-full">
      <Canvas
        className="w-full h-full"
        flat
        orthographic
        camera={{
          position: [0, 0, 100],
          up: [0, 1, 0],
          left: initialLeft,
          right: initialRight,
          near: 0.1,
          far: 1000,
          manual: true,
        }}
        gl={{
          outputColorSpace: THREE.SRGBColorSpace,
          toneMapping: THREE.NoToneMapping,
          antialias: true,
        }}
      >
        <CanvasContent
          animationId={animationId}
          namespaceId={namespaceId}
          instanceSettings={instanceSettings}
          tracks={tracks}
          selection={selection}
          scrollValue={scrollValue}
          theme={theme}
          emphasis={emphasis}
          onEmphasisChange={onEmphasisChange}
          fonts={fonts}
          trackRender={trackRender}
        />
      </Canvas>
    </TooltipHost>
  );
});

interface CanvasContentProps {
  animationId: string; // Unique ID for the animation
  namespaceId: string; // Namespace for the animation, used for scoping
  instanceSettings: AnimationInstanceSettings; // Settings for the animation instance
  tracks?: string[];
  selection?: string[];
  scrollValue?: MotionValue<number>;
  theme?: Theme.Dark | Theme.Light;
  emphasis: string[];
  onEmphasisChange?: (id: string, opt: "add" | "remove") => void;
  fonts?: {
    mono?: string; // Path to monospace font, falls back to system default
    ui?: string; // Path to UI font, falls back to system default
  };
  trackRender?: TrackRender; // Render mode for tracks, e.g. Key, Transition, Preview, Curve, etc.
}

function CanvasContent({
  animationId,
  namespaceId,
  instanceSettings,
  theme,
  scrollValue,
  trackRender,
  tracks = [],
  selection = [],
  emphasis = [],
  onEmphasisChange = () => {},
  fonts = {},
}: CanvasContentProps) {
  const bgColor = theme === Theme.Dark ? "#202020" : "#EFEFEF";

  // TrackList region offsets
  // When we allow nested/composite tracks these will need to be dynamic
  const topOffsetPx = 32;
  const bottomOffsetPx = 108;
  const trackHeight = 36;

  const size = useThree(useShallow((t) => t.size));

  const timelineOffset = useMotionValue(-size.height);

  useEffect(() => {
    console.log("size.height:", -size.height);
    timelineOffset.set(-size.height);
  }, [size.height, timelineOffset]);

  const totalContentHeightPx = useMemo(() => {
    return trackRender === TrackRender.Spline
      ? size.height - topOffsetPx - bottomOffsetPx
      : tracks.length * trackHeight;
  }, [trackRender, size.height, topOffsetPx, bottomOffsetPx, tracks.length, trackHeight]);

  return (
    <>
      <color attach="background" args={theme === Theme.Dark ? [0, 0, 0] : [1, 1, 1]} />
      <ambientLight intensity={1} />
      <PanZoomControls
        bounds={[0, 1]}
        scrollValue={scrollValue}
        trackRegion={{ top: topOffsetPx, bottom: bottomOffsetPx }}
        contentHeightPx={totalContentHeightPx}
        trackRender={trackRender}
      />
      <TrackList
        animationId={animationId}
        namespaceId={namespaceId}
        instanceSettings={instanceSettings}
        tracks={tracks}
        scrollValue={scrollValue}
        topOffsetPx={topOffsetPx}
        bottomOffsetPx={bottomOffsetPx}
        trackHeight={trackHeight}
        emphasis={emphasis}
        onEmphasisChange={onEmphasisChange}
        theme={theme}
        trackRender={trackRender}
      />

      {/* Top HUD: 32px tall */}
      <HudSection position="top" pixelHeight={32} backgroundColor={bgColor} renderPriority={1}>
        <RulerRenderer height={32} side="top" theme={theme} fonts={fonts} />
      </HudSection>

      {/* Timeline HUD: 36px tall */}
      <HudSection
        position="bottom"
        pixelHeight={36}
        backgroundColor={bgColor}
        renderPriority={2}
        gap={72}
      >
        <DataRenderer
          height={36}
          trackIds={selection}
          animationId={animationId}
          namespaceId={namespaceId}
          instanceSettings={instanceSettings}
          theme={theme}
          scrollOffset={timelineOffset}
        />
      </HudSection>

      {/* Minimap HUD: 36px tall */}
      <HudSection
        position="bottom"
        pixelHeight={36}
        gap={36}
        backgroundColor={bgColor}
        renderPriority={3}
        fixedCamera
      >
        <MinimapDisplay theme={theme} minZoom={0.1} />
      </HudSection>

      {/* Bottom HUD: 36px tall - Bottom Ruler */}
      <HudSection
        position="bottom"
        pixelHeight={36}
        backgroundColor={bgColor}
        renderPriority={4}
        fixedCamera
      >
        <RulerRenderer
          height={36}
          side="bottom"
          theme={theme === Theme.Dark ? "dark" : "light"}
          fonts={fonts}
        />
      </HudSection>
    </>
  );
}
