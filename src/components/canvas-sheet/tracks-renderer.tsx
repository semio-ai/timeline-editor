import { useThree, useFrame } from "@react-three/fiber";
import { useContext, useRef, useMemo, useCallback, memo, useEffect } from "react";
import { useShallow } from "zustand/shallow";
import { useMotionValue, useMotionValueEvent } from "motion/react";
import * as THREE from "three";
import { Theme } from "@semio/ui";
import { isOrthographicCamera } from "@semio/utils";
import { useOrthoCameraSetup, usePlaybackGestures, useBoxSelectGesture, useAnimationStore } from "../../hooks";
import { TrackRender, type VisibleSourceRowIds } from "../../types";
import { AnimationData } from "../../store-types";
import { AnimationContext } from "../../context";
import { ThemeMode } from "../../functions";
import { normalizeVisibleSourceRowIds } from "../../functions/filter-visible-source-row-ids";
import { ROW_DEPTH_EPSILON, Z } from "../../constants";
import { DataRenderer } from "./data-renderer";
import { SharedSplineBackground } from "./shared-spline-background";
import { HoverMarker } from "./overlays/hover-marker";
import { PlayheadMarker } from "./overlays/playhead-marker";
import { FrustumBackground } from "./frustum-background";
import { BoundsOverlay } from "./overlays/bounds-overlay";
import { TickBackground } from "./overlays/tick-background";
import { BoxSelectOverlay } from "./overlays/box-select-overlay";
import { useMotionCanvas } from "./shared/motion-canvas-context";

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
  // Local MotionValue mirroring store scroll — updated in useFrame for
  // consumers that need a MotionValue (e.g. DataRenderer scrollOffset).
  const scrollMotion = useMotionValue(0);

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
  // Dynamic overlay height: tracks camera span in spline mode for extending overlays
  const overlayHeightRef = useRef(availableHeight);

  // Only use pixel-locked camera setup for non-spline modes.
  // Spline mode manages camera.top/bottom via PanZoomControls + useFrame.
  useOrthoCameraSetup(
    trackRender !== TrackRender.Spline ? (camera as THREE.OrthographicCamera) : undefined,
  );

  const groupRef = useRef<THREE.Group>(null);
  const overlayGroupRef = useRef<THREE.Group>(null);
  const overlayBgMesh1Ref = useRef<THREE.Mesh>(null);
  const overlayBgMesh2Ref = useRef<THREE.Mesh>(null);
  const lastCalculatedSizeRef = useRef({ width: 0, height: 0 });
  const lastTrackRenderRef = useRef<TrackRender>(trackRender);
  const cachedPositionRef = useRef({ y: 0, trackWorldHeight: 0, worldHeight: 1 });

  // Compute world Y position for the top of the TracksRenderer with caching
  const calculatePosition = useCallback(() => {
    if (isOrthographicCamera(camera)) {
      const worldHeight0 = camera.top - camera.bottom;
      const offsetWorld = (topOffsetPx / size.height) * worldHeight0;
      const trackWorldHeight0 = (trackHeight / size.height) * worldHeight0;

      if (trackRender === TrackRender.Spline) {
        // For spline mode, center the tracks in the available area (respecting top and bottom offsets)
        const bottomOffsetWorld = (bottomOffsetPx / size.height) * worldHeight0;
        const availableTop = camera.top - offsetWorld;
        const availableBottom = camera.bottom + bottomOffsetWorld;
        const y0: number = (availableTop + availableBottom) / 2;
        return { y: y0, trackWorldHeight: trackWorldHeight0, worldHeight: worldHeight0 };
      } else {
        // Y position is at top minus offset minus half a track (so first track is flush with HUD)
        const y0: number = camera.top - offsetWorld - trackWorldHeight0 / 2;
        return { y: y0, trackWorldHeight: trackWorldHeight0, worldHeight: worldHeight0 };
      }
    } else {
      return { y: 0, trackWorldHeight: trackHeight, worldHeight: 1 };
    }
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

  const { y, trackWorldHeight, worldHeight } = positionData;

  // Imperatively update group position based on scrollValue with optimization
  const lastScrollValueRef = useRef<number>(0);
  const lastPositionRef = useRef({ y: 0, z: 0 });
  const lastFrameTrackRenderRef = useRef<TrackRender>(trackRender);

  useFrame(() => {
    if (!groupRef.current) return;

    const currentScrollPx = animationStore?.getState().scrollOffset ?? 0;
    const scrollChanged = Math.abs(currentScrollPx - lastScrollValueRef.current) > 0.1;
    const positionChanged =
      Math.abs(y - lastPositionRef.current.y) > 0.001 ||
      Math.abs(0 - lastPositionRef.current.z) > 0.001;
    const trackRenderChanged = trackRender !== lastFrameTrackRenderRef.current;

    // Only update position if scroll, calculated position, or trackRender mode changed
    if (scrollChanged || positionChanged || trackRenderChanged) {
      if (trackRender !== TrackRender.Spline) {
        const scrollWorld = (currentScrollPx / size.height) * worldHeight;
        groupRef.current.position.y = y + scrollWorld;
      } else {
        groupRef.current.position.y = y;
      }

      // Sync the local MotionValue for consumers (e.g. ViolationRenderer)
      scrollMotion.set(currentScrollPx);

      lastScrollValueRef.current = currentScrollPx;
      lastPositionRef.current = { y: groupRef.current.position.y, z: groupRef.current.position.z };
      lastFrameTrackRenderRef.current = trackRender;
    }

    // In spline mode, keep overlay group centered on camera and update overlay sizes
    if (trackRender === TrackRender.Spline && isOrthographicCamera(camera) && overlayGroupRef.current) {
      const camCenterY = (camera.top + camera.bottom) / 2;
      const camHeight = camera.top - camera.bottom;
      overlayGroupRef.current.position.y = camCenterY;
      overlayHeightRef.current = camHeight;

      // Scale the entire overlay group Y so all children (tick marks, markers,
      // backgrounds) stretch to fill the camera's vertical span.
      if (availableHeight > 0) {
        overlayGroupRef.current.scale.y = camHeight / availableHeight;
      }
    } else {
      overlayHeightRef.current = availableHeight;
    }
  });

  // Calculate the center Y position of the track area
  const trackAreaCenterY = useMemo(() => {
    const availableWorldHeight = (availableHeight / size.height) * worldHeight;

    if (trackRender === TrackRender.Spline) {
      return y; // Already centered for spline mode
    } else {
      // For non-spline, center of the available area
      if (!isOrthographicCamera(camera)) return 0;
      const offsetWorld = (topOffsetPx / size.height) * worldHeight;
      return camera.top - offsetWorld - availableWorldHeight / 2;
    }
  }, [y, worldHeight, availableHeight, size.height, trackRender, camera, topOffsetPx]);

  // Add playback gestures for seeking and hover preview
  const playbackGestures = usePlaybackGestures();
  useBoxSelectGesture("tracks", { viewId, topOffsetPx, bottomOffsetPx, trackHeightPx: trackHeight });


  // Camera Y management: pixel-locked for non-spline.
  // In spline mode, PanZoomControls manages camera.top/bottom directly.
  // Only reset to pixel height when not in spline mode or when canvas resizes.
  const lastCanvasHeightRef = useRef(motionSize.height.get());

  useMotionValueEvent(motionSize.height, "change", (height) => {
    if (!isOrthographicCamera(camera)) return;
    const prevHeight = lastCanvasHeightRef.current;
    lastCanvasHeightRef.current = height;

    if (trackRender === TrackRender.Spline) {
      // Spline mode: scale the existing camera Y proportionally on canvas resize
      if (prevHeight > 0 && prevHeight !== height) {
        const ratio = height / prevHeight;
        const center = (camera.top + camera.bottom) / 2;
        const span = (camera.top - camera.bottom) * ratio;
        camera.top = center + span / 2;
        camera.bottom = center - span / 2;
        camera.updateProjectionMatrix();
      }
    } else {
      camera.top = height / 2;
      camera.bottom = -height / 2;
      camera.updateProjectionMatrix();
    }
  });

  useEffect(() => {
    if (!isOrthographicCamera(camera)) return;
    if (trackRender !== TrackRender.Spline) {
      camera.top = motionSize.height.get() / 2;
      camera.bottom = -motionSize.height.get() / 2;
      camera.updateProjectionMatrix();
    }
  }, [camera, trackRender]);

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
            scrollOffset={trackRender !== TrackRender.Spline ? scrollMotion : undefined}
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
        <mesh ref={overlayBgMesh1Ref as any} position={[0.5, 0, Z.ForegroundBackgroundBoundary]}>
          <planeGeometry args={[1.1, availableHeight]} />
          <meshBasicMaterial
            color={theme === Theme.Dark ? "#000000" : "#FFFFFF"}
            transparent
            opacity={0.4}
          />
        </mesh>
        <mesh ref={overlayBgMesh2Ref as any} position={[0.5, 0, Z.SelectedUnselectedBoundary]}>
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
        <BoxSelectOverlay origin="tracks" parentYOffset={trackAreaCenterY} />

        <FrustumBackground
          height={availableHeight}
          visibility="transparent"
          z={-trackWorldHeight * sourceRowIds.length - 0.1}
          pointerEvents={playbackGestures}
        />
      </group>
    </>
  );
});
