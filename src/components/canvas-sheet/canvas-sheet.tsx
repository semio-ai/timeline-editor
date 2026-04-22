import { memo, useMemo, useState, useCallback } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { useShallow } from "zustand/shallow";
import * as THREE from "three";
import { Theme, TooltipHost } from "@semio/ui";
import { usePlayerStore } from "@semio/utils";
import { TrackRender } from "../../types";
import { PanZoomControls } from "../controls/pan-zoom-controls";
import { calculatePaddedFrustum } from "../../viewport-utils";
import { AnimationData } from "../../store-types";
import { useAnimationStore } from "../../hooks";
import type { VisibleSourceRowIds } from "../../types";

import { normalizeVisibleSourceRowIds } from "../../functions/filter-visible-source-row-ids";
import { MotionCanvasProvider } from "./shared/motion-canvas-provider";
import { HudSection } from "./hud-section";
import { RulerRenderer } from "./ruler-renderer";
import { TracksRenderer } from "./tracks-renderer";
import { MinimapDisplay } from "./minimap-display";
import { TimelineRenderer } from "./timeline-renderer";

export interface CanvasSheetProps {
  viewId: string;
  theme?: Theme.Dark | Theme.Light;
  rowIdLookup?: VisibleSourceRowIds;
  fonts?: {
    mono?: string; // Path to monospace font, falls back to system default
    ui?: string; // Path to UI font, falls back to system default
  };
}

export const CanvasSheet = memo(function CanvasSheet({
  viewId,
  theme = Theme.Light,
  rowIdLookup,
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
  );

  const [ready, setReady] = useState(false);
  const handleCreated = useCallback(() => setReady(true), []);

  return (
    <TooltipHost className="h-full w-full">
      <Canvas
        // @ts-ignore R3F v9 CanvasProps doesn't expose HTMLAttributes in React 19
        style={{
          width: "100%",
          height: "100%",
          opacity: ready ? 1 : 0,
          transition: "opacity 0.2s ease-in",
        }}
        flat
        orthographic
        onCreated={handleCreated}
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
        <CanvasContent viewId={viewId} theme={theme} rowIdLookup={rowIdLookup} fonts={fonts} />
      </Canvas>
    </TooltipHost>
  );
});

interface CanvasContentProps {
  viewId: string;
  theme?: Theme.Dark | Theme.Light;
  rowIdLookup?: VisibleSourceRowIds;
  fonts?: {
    mono?: string; // Path to monospace font, falls back to system default
    ui?: string; // Path to UI font, falls back to system default
  };
}

const CanvasContent = memo(function CanvasContent({
  viewId,
  theme,
  rowIdLookup,
  fonts = {},
}: CanvasContentProps) {
  const bgColor = theme === Theme.Dark ? "#202020" : "#EFEFEF";

  const resolvedRowIdLookup = useAnimationStore(
    useShallow(
      (state: AnimationData) =>
        rowIdLookup ??
        normalizeVisibleSourceRowIds(state.sourceRowIdsByView[viewId] ?? state.sourceRowIds),
    ),
  );
  const trackRender = useAnimationStore(
    useShallow((state: AnimationData) => state.editorViews[viewId]?.trackRender ?? TrackRender.Key),
  );
  const boxSelectActive = useAnimationStore(
    useShallow((state: AnimationData) => state.boxSelectState !== null),
  );

  // TrackList region offsets
  // When we allow nested/composite tracks these will need to be dynamic
  const topOffsetPx = 36;
  const bottomOffsetPx = 108;
  const trackHeight = 36;

  const size = useThree((t) => t.size);
  const flatRowCount = resolvedRowIdLookup.flat.length;

  const totalContentHeightPx = useMemo(() => {
    return trackRender === TrackRender.Spline
      ? size.height - topOffsetPx - bottomOffsetPx
      : flatRowCount * trackHeight;
  }, [trackRender, size.height, topOffsetPx, bottomOffsetPx, flatRowCount, trackHeight]);

  return (
    <>
      <color attach="background" args={theme === Theme.Dark ? [0, 0, 0] : [1, 1, 1]} />
      <ambientLight intensity={1} />
      <PanZoomControls
        trackRegion={{ top: topOffsetPx, bottom: bottomOffsetPx }}
        contentHeightPx={totalContentHeightPx}
        trackRender={trackRender}
        enabled={!boxSelectActive}
      />
      <MotionCanvasProvider label="MainCamera">
        <TracksRenderer
          viewId={viewId}
          topOffsetPx={topOffsetPx}
          bottomOffsetPx={bottomOffsetPx}
          trackHeight={trackHeight}
          rowIdLookup={resolvedRowIdLookup}
          theme={theme}
        />
      </MotionCanvasProvider>

      {/* Top HUD: 36px tall */}
      <HudSection
        label="top-hud"
        position="top"
        pixelHeight={36}
        backgroundColor={bgColor}
        renderPriority={1}
      >
        <RulerRenderer height={36} side="top" theme={theme} fonts={fonts} />
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
        <TimelineRenderer theme={theme} viewId={viewId} />
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
        <MinimapDisplay theme={theme} minZoom={100} height={36} />
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
