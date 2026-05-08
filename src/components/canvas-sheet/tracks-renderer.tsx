import { useThree, useFrame } from "@react-three/fiber";
import { useContext, useRef, useMemo, useCallback, memo, useEffect } from "react";
import { useShallow } from "zustand/shallow";
import * as THREE from "three";
import { Theme, useCanvasContextMenu } from "@semio/ui";
import { isOrthographicCamera } from "@semio/utils";
import { usePlaybackGestures, useBoxSelectGesture, useAnimationStore } from "../../hooks";
import { TrackRender, type VisibleSourceRowIds } from "../../types";
import { AnimationData } from "../../store-types";
import { AnimationContext } from "../../context";
import { ThemeMode } from "../../functions";
import { normalizeVisibleSourceRowIds } from "../../functions/filter-visible-source-row-ids";
import { ROW_DEPTH_EPSILON, Z } from "../../constants";
import {
  splineCameraYMotion,
  trackScrollMotion,
  verticalFitCounterMotion,
  resetSplineCameraY,
} from "../../viewport-state";
import { DataRenderer } from "./data-renderer";
import { SharedSplineBackground } from "./shared-spline-background";
import { HoverMarker } from "./overlays/hover-marker";
import { PlayheadMarker } from "./overlays/playhead-marker";
import { FrustumBackground } from "./frustum-background";
import { BoundsOverlay } from "./overlays/bounds-overlay";
import { TickBackground } from "./overlays/tick-background";
import { BoxSelectOverlay } from "./overlays/box-select-overlay";
import { useMotionCanvas } from "./shared/motion-canvas-context";
import { buildTrackMenuItems } from "./context-menus";

interface TracksRendererProps {
  viewId: string;
  trackHeight?: number;
  topOffsetPx?: number;
  bottomOffsetPx?: number;
  theme?: ThemeMode;
  rowIdLookup?: VisibleSourceRowIds;
}

export const TracksRenderer = memo(function TracksRenderer({
  viewId,
  trackHeight = 36,
  topOffsetPx = 32,
  bottomOffsetPx = 108,
  theme = Theme.Light,
  rowIdLookup,
}: TracksRendererProps) {
  const { size, camera } = useThree();
  const { size: motionSize } = useMotionCanvas();
  const animationStore = useContext(AnimationContext);

  const sourceRowLookup = useAnimationStore(
    useShallow(
      (state: AnimationData) =>
        rowIdLookup ??
        normalizeVisibleSourceRowIds(state.sourceRowIdsByView[viewId] ?? state.sourceRowIds),
    ),
  );

  const trackRender = useAnimationStore(
    useShallow((state: AnimationData) => state.editorViews[viewId]?.trackRender ?? TrackRender.Key),
  );

  const sourceRowIds =
    trackRender === TrackRender.Spline ? sourceRowLookup.spline : sourceRowLookup.flat;

  const availableHeight = size.height - topOffsetPx - bottomOffsetPx;

  // Mirror current vertical-axis state into the camera synchronously during
  // render. `calculatePosition` (a useMemo below) reads camera.top/bottom,
  // so they must be valid before that runs. The async useEffect-based
  // subscription handles subsequent MotionValue changes; this synchronous
  // write covers the initial render and any re-render where the cache might
  // otherwise be stale (e.g. mode switch).
  if (isOrthographicCamera(camera) && size.height > 0) {
    if (trackRender === TrackRender.Spline) {
      const cy = splineCameraYMotion.get();
      if (cy.top - cy.bottom > 0) {
        camera.top = cy.top;
        camera.bottom = cy.bottom;
      } else {
        camera.top = size.height / 2;
        camera.bottom = -size.height / 2;
      }
    } else {
      const scroll = trackScrollMotion.get();
      camera.top = size.height / 2 - scroll;
      camera.bottom = -size.height / 2 - scroll;
    }
    camera.updateProjectionMatrix();
  }

  const groupRef = useRef<THREE.Group>(null);
  const overlayGroupRef = useRef<THREE.Group>(null);
  const lastCalculatedSizeRef = useRef({ width: 0, height: 0 });
  const lastTrackRenderRef = useRef<TrackRender>(trackRender);
  const cachedPositionRef = useRef({ y: 0, trackWorldHeight: 0, worldHeight: 1 });

  // Compute world Y position for the top of the TracksRenderer with caching.
  //
  // Non-spline mode is pixel-locked (1 world unit = 1 pixel), so the group
  // origin is computed directly from `size.height` — independent of
  // `camera.top` (which is now scroll-shifted). This keeps the group at a
  // fixed scene Y; vertical scroll is expressed by camera motion only.
  //
  // Spline mode uses the camera's available area to center the group, since
  // the spline camera Y is free-form and the cached position should reflect
  // the camera's current frustum at the time of recompute.
  const calculatePosition = useCallback(() => {
    if (trackRender === TrackRender.Spline) {
      if (!isOrthographicCamera(camera)) {
        return { y: 0, trackWorldHeight: trackHeight, worldHeight: 1 };
      }
      const worldHeight0 = camera.top - camera.bottom;
      const offsetWorld = (topOffsetPx / size.height) * worldHeight0;
      const trackWorldHeight0 = (trackHeight / size.height) * worldHeight0;
      const bottomOffsetWorld = (bottomOffsetPx / size.height) * worldHeight0;
      const availableTop = camera.top - offsetWorld;
      const availableBottom = camera.bottom + bottomOffsetWorld;
      const y0: number = (availableTop + availableBottom) / 2;
      return { y: y0, trackWorldHeight: trackWorldHeight0, worldHeight: worldHeight0 };
    }
    // Non-spline: pixel-locked. Group origin sits at the top-of-available
    // minus half a track (first row flush with the HUD). Independent of scroll.
    const y0: number = size.height / 2 - topOffsetPx - trackHeight / 2;
    return { y: y0, trackWorldHeight: trackHeight, worldHeight: size.height };
  }, [camera, topOffsetPx, bottomOffsetPx, trackHeight, trackRender, size.height]);

  // Only recalculate positions when size or trackRender actually changes significantly
  const positionData = useMemo(() => {
    const sizeChanged =
      Math.abs(size.width - lastCalculatedSizeRef.current.width) > 1 ||
      Math.abs(size.height - lastCalculatedSizeRef.current.height) > 1;

    const trackRenderChanged = trackRender !== lastTrackRenderRef.current;

    if (sizeChanged || trackRenderChanged || !cachedPositionRef.current) {
      const newPosition = calculatePosition();
      lastCalculatedSizeRef.current = { width: size.width, height: size.height };
      lastTrackRenderRef.current = trackRender;
      cachedPositionRef.current = newPosition;
      return newPosition;
    }

    return cachedPositionRef.current;
  }, [calculatePosition, size.width, size.height, trackRender]);

  const { y, trackWorldHeight } = positionData;

  // Group always sits at the cached scene Y. Vertical scroll/zoom is
  // expressed by camera motion (driven by viewport-state), not by
  // translating the group. The group's Y is rewritten only when the
  // calculated origin changes (canvas resize, mode switch).
  const lastPositionRef = useRef({ y: 0 });
  useFrame(() => {
    if (!groupRef.current) return;
    if (Math.abs(y - lastPositionRef.current.y) > 0.001) {
      groupRef.current.position.y = y;
      lastPositionRef.current.y = y;
    }

    // Keep overlay group centered on the camera and stretched to its vertical
    // span. Works uniformly in spline (free camera Y / zoom) and non-spline
    // (pixel-locked camera, Y = -scroll, height = canvas height) so tick
    // marks, hover/playhead markers, and backgrounds always fill the visible
    // viewport regardless of mode or scroll position.
    if (isOrthographicCamera(camera) && overlayGroupRef.current) {
      const camCenterY = (camera.top + camera.bottom) / 2;
      const camHeight = camera.top - camera.bottom;
      overlayGroupRef.current.position.y = camCenterY;
      if (availableHeight > 0) {
        overlayGroupRef.current.scale.y = camHeight / availableHeight;
      }
    }
  });

  // Calculate the center Y position of the track area.
  // Spline mode: group is already centered, overlay sits at the same Y.
  // Non-spline: pixel-locked. Center of available area in scene Y is
  // independent of scroll (camera Y shifts to express scroll, but content
  // and overlays sit at fixed scene Y).
  const trackAreaCenterY = useMemo(() => {
    if (trackRender === TrackRender.Spline) {
      return y;
    }
    return size.height / 2 - topOffsetPx - availableHeight / 2;
  }, [y, availableHeight, size.height, trackRender, topOffsetPx]);

  // Add playback gestures for seeking and hover preview
  const playbackGestures = usePlaybackGestures();
  const boxSelectPointerDown = useBoxSelectGesture("tracks", {
    viewId,
    topOffsetPx,
    bottomOffsetPx,
    trackHeightPx: trackHeight,
    contentRowCount: sourceRowLookup.flat.length,
  });

  const { onContextMenu } = useCanvasContextMenu({
    items: (ctx) => buildTrackMenuItems(ctx, animationStore),
  });

  // Camera Y management:
  // - Spline: camera.top/bottom mirrors splineCameraYMotion (free Y, supports zoom)
  // - Non-spline: camera.top/bottom is pixel-locked, shifted by trackScrollMotion
  //
  // Mode change re-seeds splineCameraYMotion to pixel-locked default; canvas
  // resize rescales spline camera Y proportionally.
  const lastCanvasHeightRef = useRef(motionSize.height.get());

  useEffect(() => {
    if (!isOrthographicCamera(camera)) return;

    const applyVertical = () => {
      const h = motionSize.height.get();
      if (h <= 0) return;
      if (trackRender === TrackRender.Spline) {
        const cy = splineCameraYMotion.get();
        camera.top = cy.top;
        camera.bottom = cy.bottom;
      } else {
        const scroll = trackScrollMotion.get();
        camera.top = h / 2 - scroll;
        camera.bottom = -h / 2 - scroll;
      }
      camera.updateProjectionMatrix();
    };

    // Seed spline camera Y to pixel-locked default on mount / mode change.
    const h0 = motionSize.height.get();
    if (h0 > 0) {
      splineCameraYMotion.set({ top: h0 / 2, bottom: -h0 / 2 });
      lastCanvasHeightRef.current = h0;
    }
    applyVertical();

    const unsubSpline = splineCameraYMotion.on("change", () => {
      if (trackRender === TrackRender.Spline) applyVertical();
    });
    const unsubScroll = trackScrollMotion.on("change", () => {
      if (trackRender !== TrackRender.Spline) applyVertical();
    });
    const unsubHeight = motionSize.height.on("change", (newHeight) => {
      if (newHeight <= 0) return;
      const prevH = lastCanvasHeightRef.current;
      lastCanvasHeightRef.current = newHeight;
      if (trackRender === TrackRender.Spline && prevH > 0 && prevH !== newHeight) {
        const cy = splineCameraYMotion.get();
        if (cy.top - cy.bottom > 0) {
          const ratio = newHeight / prevH;
          const center = (cy.top + cy.bottom) / 2;
          const span = (cy.top - cy.bottom) * ratio;
          splineCameraYMotion.set({ top: center + span / 2, bottom: center - span / 2 });
        }
      } else {
        applyVertical();
      }
    });
    // Fit-to-Viewport / Fit-to-Content signal. Only meaningful in spline
    // mode (resets the freely-pannable camera Y). In non-spline modes the
    // user's track scroll position is preserved — fit only affects the
    // horizontal viewport.
    const unsubFit = verticalFitCounterMotion.on("change", (counter) => {
      if (counter === 0) return;
      if (trackRender !== TrackRender.Spline) return;
      const h = motionSize.height.get();
      if (h > 0) resetSplineCameraY(h);
    });

    return () => {
      unsubSpline();
      unsubScroll();
      unsubHeight();
      unsubFit();
    };
  }, [camera, trackRender, motionSize]);

  return (
    <>
      <group ref={groupRef as any}>
        {sourceRowIds.map((sourceId, idx) => (
          <DataRenderer
            key={sourceId}
            trackRender={trackRender}
            height={trackRender === TrackRender.Spline ? availableHeight : trackHeight}
            sourceRowId={sourceId}
            viewId={viewId}
            yOffset={trackRender === TrackRender.Spline ? 0 : -trackWorldHeight * idx}
            theme={theme}
            onBoxSelectStart={boxSelectPointerDown}
          />
        ))}
        {trackRender === TrackRender.Spline && (
          <SharedSplineBackground
            sourceRowId={viewId}
            height={availableHeight}
            yOffset={0}
            baseZ={-ROW_DEPTH_EPSILON}
            theme={theme}
          />
        )}
      </group>

      {/* Render the hover markers and add a gesture detector */}
      <group ref={overlayGroupRef as any} position={[0, trackAreaCenterY, 0]}>
        <mesh position={[0.5, 0, Z.ForegroundBackgroundBoundary]} raycast={() => {}}>
          <planeGeometry args={[1.1, availableHeight]} />
          <meshBasicMaterial
            color={theme === Theme.Dark ? "#000000" : "#FFFFFF"}
            transparent
            opacity={0.4}
          />
        </mesh>
        <mesh position={[0.5, 0, Z.SelectedUnselectedBoundary]} raycast={() => {}}>
          <planeGeometry args={[1.1, availableHeight]} />
          <meshBasicMaterial
            color={theme === Theme.Dark ? "#000000" : "#FFFFFF"}
            transparent
            opacity={0.3}
          />
        </mesh>

        <TickBackground height={availableHeight} theme={theme} />
        <HoverMarker height={availableHeight} theme={theme} />
        <PlayheadMarker height={availableHeight} theme={theme} />
        <BoundsOverlay height={availableHeight} theme={theme} />
        <BoxSelectOverlay origin="tracks" />

        <FrustumBackground
          height={availableHeight}
          visibility="transparent"
          z={Z.Background - 1}
          pointerEvents={{ ...playbackGestures, onPointerDown: boxSelectPointerDown, onContextMenu }}
        />
      </group>
    </>
  );
});
