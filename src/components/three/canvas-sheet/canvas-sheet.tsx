import { memo, useMemo } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { useShallow } from "zustand/shallow";
import * as THREE from "three";
import { Theme, TooltipHost } from "@semio/ui";
import { MotionValue } from "motion/react";
import { usePlayerStore } from "@semio/utils";
import { AnimationInstanceSettings, Source, TrackRender } from "../../../types";
import { PanZoomControls } from "../controls/pan-zoom-controls";
import { calculatePaddedFrustum } from "../../../viewport-utils";
import { useAnimationStore } from "../../../hooks";
import { MotionCanvasProvider } from "./shared/motion-canvas-provider";
import { HudSection } from "./hud-section";
import { RulerRenderer } from "./ruler-renderer";
import { TracksRenderer } from "./tracks-renderer";
import { MinimapDisplay } from "./minimap-display";
import { TimelineRenderer } from "./timeline-renderer";

export interface CanvasSheetProps {
  animationId: string; // Unique ID for the animation
  namespaceId: string; // Namespace for the animation, used for scoping
  instanceSettings: AnimationInstanceSettings; // Settings for the animation instance
  tracks?: string[];
  selection?: string[];
  scrollValue?: MotionValue<number>;
  theme?: Theme.Dark | Theme.Light;
  expanded: string[];
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
  expanded = [],
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
          animationId={animationId}
          namespaceId={namespaceId}
          instanceSettings={instanceSettings}
          tracks={tracks}
          expanded={expanded}
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
  expanded?: string[];
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

const CanvasContent = memo(function CanvasContent({
  animationId,
  namespaceId,
  instanceSettings,
  theme,
  scrollValue,
  trackRender,
  tracks = [],
  expanded = [],
  selection = [],
  emphasis = [],
  onEmphasisChange = () => {},
  fonts = {},
}: CanvasContentProps) {
  const bgColor = theme === Theme.Dark ? "#202020" : "#EFEFEF";

  const [trackData, animatableData] = useAnimationStore(
    useShallow((state) => [state.tracks, state.animatables]),
  );

  const sources: Source[] = useMemo(() => {
    const result: Source[] = [];
    tracks.forEach((trackId) => {
      const track = trackData[trackId];
      if (!track) return;
      const animatable = animatableData[track.animatableId];
      if (!animatable) return;

      // Always add the main track row
      result.push({ trackId, type: animatable.type });

      // If the track is expanded and has attributes, add each attribute as a separate row
      // in addition to the main track row;
      if (
        (expanded.includes(trackId) || trackRender === TrackRender.Spline) &&
        collapsibleTypes.includes(animatable.type)
      ) {
        typeAttributes[animatable.type].forEach((attr) => {
          result.push({ trackId, type: animatable.type, attribute: attr });
        });
      }
    });

    return result;
  }, [tracks, expanded, animatableData, trackData, trackRender]);

  // TrackList region offsets
  // When we allow nested/composite tracks these will need to be dynamic
  const topOffsetPx = 32;
  const bottomOffsetPx = 108;
  const trackHeight = 36;

  const size = useThree((t) => t.size);

  const totalContentHeightPx = useMemo(() => {
    return trackRender === TrackRender.Spline
      ? size.height - topOffsetPx - bottomOffsetPx
      : sources.length * trackHeight;
  }, [trackRender, size.height, topOffsetPx, bottomOffsetPx, sources.length, trackHeight]);

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
          animationId={animationId}
          namespaceId={namespaceId}
          instanceSettings={instanceSettings}
          sources={sources}
          scrollValue={scrollValue}
          topOffsetPx={topOffsetPx}
          bottomOffsetPx={bottomOffsetPx}
          trackHeight={trackHeight}
          emphasis={emphasis}
          onEmphasisChange={onEmphasisChange}
          theme={theme}
          trackRender={trackRender}
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
        <TimelineRenderer
          selection={selection}
          animationId={animationId}
          namespaceId={namespaceId}
          instanceSettings={instanceSettings}
          theme={theme}
          sources={sources}
        />
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

const collapsibleTypes = ["vector3", "vector2", "euler", "rgb", "hsl"];

const typeAttributes: Record<string, string[]> = {
  vector3: ["x", "y", "z"],
  vector2: ["x", "y"],
  euler: ["r", "p", "y"],
  rgb: ["r", "g", "b"],
  hsl: ["h", "s", "l"],
};
