import { memo, useMemo, useState, useCallback } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { useShallow } from "zustand/shallow";
import * as THREE from "three";
import { Theme, TooltipHost } from "@semio/ui";
import { usePlayerStore } from "@semio/utils";
import { TrackRender } from "../../types";
import { PanZoomControls } from "../controls/pan-zoom-controls";
import { calculatePaddedFrustum } from "../../viewport-utils";
import { viewportMotion } from "../../viewport-state";
import { AnimationData } from "../../store-types";
import { useAnimationStore } from "../../hooks";
import type { VisibleSourceRowIds } from "../../types";

import { normalizeVisibleSourceRowIds } from "../../functions/filter-visible-source-row-ids";
import { MotionCanvasProvider } from "./shared/motion-canvas-provider";
import { CanvasCamera } from "./canvas-camera";
import { RulerRenderer } from "./ruler-renderer";
import { TracksRenderer } from "./tracks-renderer";
import { MinimapDisplay } from "./minimap-display";
import { TimelineRenderer } from "./timeline-renderer";

/**
 * The animation view's canvas content is split across three stacked
 * `<Canvas>` instances rather than rendered into one canvas with multiple
 * `<Hud>` portal scenes:
 *
 *   - {@link TimelineCanvas}: top region (top ruler + timeline). Camera X
 *     follows the panned/zoomed viewport; Y is pixel-locked.
 *   - {@link TracksCanvas}: middle region (tracks + overlays + pan/zoom).
 *     Camera X follows viewport (managed by PanZoomControls); Y is mode-
 *     aware (managed by TracksRenderer).
 *   - {@link MinimapCanvas}: bottom region (minimap + bottom ruler). Camera
 *     X is fixed at `[0, max(duration, 1000)]`; Y is pixel-locked.
 *
 * Layout is owned by the grid in {@link AnimationSheet}; each canvas fills
 * its grid cell. Cross-canvas state coordination happens through the
 * `viewport-state` module-level MotionValues + the player store.
 */

interface CanvasFontProps {
  fonts?: {
    mono?: string;
    ui?: string;
  };
}

const GL_OPTIONS = {
  outputColorSpace: THREE.SRGBColorSpace,
  toneMapping: THREE.NoToneMapping,
  antialias: true,
} as const;

const ESTIMATED_CANVAS_WIDTH = 800;
const ROW_HEIGHT = 36;
const ROW_HALF = ROW_HEIGHT / 2;

// ---------------------------------------------------------------------------
// Top canvas: ruler + timeline
// ---------------------------------------------------------------------------

export interface TimelineCanvasProps extends CanvasFontProps {
  viewId: string;
  theme?: Theme.Dark | Theme.Light;
}

export const TimelineCanvas = memo(function TimelineCanvas({
  viewId,
  theme = Theme.Light,
  fonts = {},
}: TimelineCanvasProps) {
  const initialViewport = viewportMotion.get();
  const { left, right } = calculatePaddedFrustum(initialViewport, ESTIMATED_CANVAS_WIDTH);
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
          name: "TimelineCamera",
          position: [0, 0, 100],
          up: [0, 1, 0],
          left,
          right,
          top: ROW_HEIGHT,
          bottom: -ROW_HEIGHT,
          near: 0.1,
          far: 1000,
          manual: true,
        }}
        gl={GL_OPTIONS}
      >
        <ambientLight intensity={1} />
        <MotionCanvasProvider label="TimelineCamera">
          <CanvasCamera mode="moving" />
          <TimelineCanvasContent viewId={viewId} theme={theme} fonts={fonts} />
        </MotionCanvasProvider>
      </Canvas>
    </TooltipHost>
  );
});

const TimelineCanvasContent = memo(function TimelineCanvasContent({
  viewId,
  theme,
  fonts,
}: {
  viewId: string;
  theme: Theme.Light | Theme.Dark;
  fonts: { mono?: string; ui?: string };
}) {
  // Selector form: re-render only when canvas size actually changes, not on
  // every R3F state mutation (camera moves, raycast hits, mouse moves, etc).
  const size = useThree((s) => s.size);
  const topRowY = size.height / 2 - ROW_HALF;
  const bottomRowY = -size.height / 2 + ROW_HALF;

  return (
    <>
      <group position={[0, topRowY, 0]}>
        <RulerRenderer height={ROW_HEIGHT} side="top" theme={theme} fonts={fonts} />
      </group>
      <group position={[0, bottomRowY, 0]}>
        <TimelineRenderer theme={theme} viewId={viewId} />
      </group>
    </>
  );
});

// ---------------------------------------------------------------------------
// Middle canvas: tracks + overlays + pan/zoom controls
// ---------------------------------------------------------------------------

export interface TracksCanvasProps {
  viewId: string;
  theme?: Theme.Dark | Theme.Light;
  rowIdLookup?: VisibleSourceRowIds;
}

export const TracksCanvas = memo(function TracksCanvas({
  viewId,
  theme = Theme.Light,
  rowIdLookup,
}: TracksCanvasProps) {
  const initialViewport = viewportMotion.get();
  const { left, right } = calculatePaddedFrustum(initialViewport, ESTIMATED_CANVAS_WIDTH);
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
          left,
          right,
          near: 0.1,
          far: 1000,
          manual: true,
        }}
        gl={GL_OPTIONS}
      >
        <TracksCanvasContent viewId={viewId} theme={theme} rowIdLookup={rowIdLookup} />
      </Canvas>
    </TooltipHost>
  );
});

const TracksCanvasContent = memo(function TracksCanvasContent({
  viewId,
  theme,
  rowIdLookup,
}: {
  viewId: string;
  theme: Theme.Light | Theme.Dark;
  rowIdLookup?: VisibleSourceRowIds;
}) {
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

  const flatRowCount = resolvedRowIdLookup.flat.length;
  const trackHeight = ROW_HEIGHT;
  // Used to clamp non-spline scroll. Unused in spline (spline pan is unbounded).
  const totalContentHeightPx = useMemo(
    () => flatRowCount * trackHeight,
    [flatRowCount, trackHeight],
  );

  return (
    <>
      <color attach="background" args={theme === Theme.Dark ? [0, 0, 0] : [1, 1, 1]} />
      <ambientLight intensity={1} />
      <PanZoomControls
        trackRegion={{ top: 0, bottom: 0 }}
        contentHeightPx={totalContentHeightPx}
        trackRender={trackRender}
        enabled={!boxSelectActive}
      />
      <MotionCanvasProvider label="MainCamera">
        <TracksRenderer
          viewId={viewId}
          topOffsetPx={0}
          bottomOffsetPx={0}
          trackHeight={trackHeight}
          rowIdLookup={resolvedRowIdLookup}
          theme={theme}
        />
      </MotionCanvasProvider>
    </>
  );
});

// ---------------------------------------------------------------------------
// Bottom canvas: minimap + bottom ruler
// ---------------------------------------------------------------------------

export interface MinimapCanvasProps extends CanvasFontProps {
  theme?: Theme.Dark | Theme.Light;
}

export const MinimapCanvas = memo(function MinimapCanvas({
  theme = Theme.Light,
  fonts = {},
}: MinimapCanvasProps) {
  const initialDuration = usePlayerStore.getState().player.duration;
  const initialFixed: [number, number] = [0, Math.max(initialDuration, 1000)];
  const { left, right } = calculatePaddedFrustum(initialFixed, ESTIMATED_CANVAS_WIDTH);
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
          name: "MinimapCamera",
          position: [0, 0, 100],
          up: [0, 1, 0],
          left,
          right,
          top: ROW_HEIGHT,
          bottom: -ROW_HEIGHT,
          near: 0.1,
          far: 1000,
          manual: true,
        }}
        gl={GL_OPTIONS}
      >
        <ambientLight intensity={1} />
        <MotionCanvasProvider label="MinimapCamera">
          <CanvasCamera mode="fixed" />
          <MinimapCanvasContent theme={theme} fonts={fonts} />
        </MotionCanvasProvider>
      </Canvas>
    </TooltipHost>
  );
});

const MinimapCanvasContent = memo(function MinimapCanvasContent({
  theme,
  fonts,
}: {
  theme: Theme.Light | Theme.Dark;
  fonts: { mono?: string; ui?: string };
}) {
  const size = useThree((s) => s.size);
  const topRowY = size.height / 2 - ROW_HALF;
  const bottomRowY = -size.height / 2 + ROW_HALF;

  return (
    <>
      <group position={[0, topRowY, 0]}>
        <MinimapDisplay theme={theme} minZoom={100} height={ROW_HEIGHT} />
      </group>
      <group position={[0, bottomRowY, 0]}>
        <RulerRenderer height={ROW_HEIGHT} side="bottom" theme={theme} fonts={fonts} />
      </group>
    </>
  );
});
