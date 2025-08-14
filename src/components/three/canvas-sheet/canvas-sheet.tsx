import { memo } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { Theme, TooltipHost } from "@semio/ui";
import { MotionValue } from "motion";
import { AnimationInstanceSettings } from "../../../types";
import { PanZoomControls } from "../controls/pan-zoom-controls";
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
}: CanvasSheetProps) {
  const bgColor = theme === Theme.Dark ? "#202020" : "#EFEFEF";

  // Use simple initial bounds that will be immediately corrected by PanZoomControls
  // This prevents initialization timing issues with canvas width calculations
  const initialLeft = -0.1;
  const initialRight = 1.1;

  // TrackList region offsets
  // When we allow nested/composite tracks these will need to be dynamic
  const topOffsetPx = 32;
  const bottomOffsetPx = 108;
  const trackHeight = 36;
  const totalContentHeightPx = tracks.length * trackHeight;

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
        <ambientLight intensity={1} />
        <PanZoomControls
          bounds={[0, 1]}
          scrollValue={scrollValue}
          trackRegion={{ top: topOffsetPx, bottom: bottomOffsetPx }}
          contentHeightPx={totalContentHeightPx}
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
      </Canvas>
    </TooltipHost>
  );
});
