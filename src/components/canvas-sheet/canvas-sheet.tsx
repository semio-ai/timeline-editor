import { memo, useMemo } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { useShallow } from "zustand/shallow";
import * as THREE from "three";
import { Theme, TooltipHost } from "@semio/ui";
import { MotionValue } from "motion/react";
import { usePlayerStore } from "@semio/utils";
import { SourceRow, TrackRender } from "../../types";
import { PanZoomControls } from "../controls/pan-zoom-controls";
import { calculatePaddedFrustum } from "../../viewport-utils";
import { AnimationData } from "../../store-types";
import { useAnimationStore } from "../../hooks";
import { MotionCanvasProvider } from "./shared/motion-canvas-provider";
import { HudSection } from "./hud-section";
import { RulerRenderer } from "./ruler-renderer";
import { TracksRenderer } from "./tracks-renderer";
import { MinimapDisplay } from "./minimap-display";
import { TimelineRenderer } from "./timeline-renderer";

export interface CanvasSheetProps {
  viewId: string;
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
  viewId,
  scrollValue,
  theme = Theme.Light,
  emphasis = [],
  onEmphasisChange = () => {},
  fonts = {},
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
        style={{ width: "100%", height: "100%" }}
        flat
        orthographic
        resize={{ debounce: 0 }}
        camera={{
          name: "MainCamera",
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
          viewId={viewId}
          scrollValue={scrollValue}
          theme={theme}
          emphasis={emphasis}
          onEmphasisChange={onEmphasisChange}
          fonts={fonts}
        />
      </Canvas>
    </TooltipHost>
  );
});

interface CanvasContentProps {
  viewId: string;
  scrollValue?: MotionValue<number>;
  theme?: Theme.Dark | Theme.Light;
  emphasis: string[];
  onEmphasisChange?: (id: string, opt: "add" | "remove") => void;
  fonts?: {
    mono?: string; // Path to monospace font, falls back to system default
    ui?: string; // Path to UI font, falls back to system default
  };
}

const defaultRowIds: string[] = [];

const CanvasContent = memo(function CanvasContent({
  viewId,
  theme,
  scrollValue,
  emphasis = [],
  onEmphasisChange = () => {},
  fonts = {},
}: CanvasContentProps) {
  const bgColor = theme === Theme.Dark ? "#202020" : "#EFEFEF";

  const rowIds = useAnimationStore(
    useShallow((state: AnimationData) => state.editorViews[viewId]?.sourceRowIds ?? defaultRowIds),
  );
  const trackRender = useAnimationStore(
    useShallow((state: AnimationData) => state.editorViews[viewId]?.trackRender ?? TrackRender.Key),
  );

  // TrackList region offsets
  // When we allow nested/composite tracks these will need to be dynamic
  const topOffsetPx = 32;
  const bottomOffsetPx = 108;
  const trackHeight = 36;

  const size = useThree((t) => t.size);

  const totalContentHeightPx = useMemo(() => {
    return trackRender === TrackRender.Spline
      ? size.height - topOffsetPx - bottomOffsetPx
      : rowIds.length * trackHeight;
  }, [trackRender, size.height, topOffsetPx, bottomOffsetPx, rowIds.length, trackHeight]);

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
      <MotionCanvasProvider label="MainCamera">
        <TracksRenderer
          viewId={viewId}
          scrollValue={scrollValue}
          topOffsetPx={topOffsetPx}
          bottomOffsetPx={bottomOffsetPx}
          trackHeight={trackHeight}
          emphasis={emphasis}
          onEmphasisChange={onEmphasisChange}
          theme={theme}
        />
      </MotionCanvasProvider>

      {/* Top HUD: 32px tall */}
      <HudSection
        label="top-hud"
        position="top"
        pixelHeight={32}
        backgroundColor={bgColor}
        renderPriority={1}
      >
        <RulerRenderer height={32} side="top" theme={theme} fonts={fonts} />
      </HudSection>

      {/* Timeline HUD: 36px tall */}
      <HudSection
        label="timeline"
        position="bottom"
        pixelHeight={36}
        backgroundColor={bgColor}
        renderPriority={2}
        gap={72}
      >
        <TimelineRenderer viewId={viewId} theme={theme} />
      </HudSection>

      {/* Minimap HUD: 36px tall */}
      <HudSection
        label="minimap"
        position="bottom"
        pixelHeight={36}
        gap={36}
        backgroundColor={bgColor}
        renderPriority={3}
        fixedCamera
      >
        <MinimapDisplay theme={theme} minZoom={0.1} height={36} />
      </HudSection>

      {/* Bottom HUD: 36px tall - Bottom Ruler */}
      <HudSection
        label="bottom-hud"
        position="bottom"
        pixelHeight={36}
        backgroundColor={bgColor}
        renderPriority={4}
        fixedCamera
      >
        <RulerRenderer height={36} side="bottom" theme={theme} fonts={fonts} />
      </HudSection>
    </>
  );
});
