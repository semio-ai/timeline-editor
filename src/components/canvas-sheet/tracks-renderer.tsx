import { useThree, useFrame } from "@react-three/fiber";
import { useRef, useMemo, useCallback, memo, useEffect } from "react";
import { useShallow } from "zustand/shallow";
import { MotionValue, useMotionValueEvent } from "motion/react";
import * as THREE from "three";
import { Theme } from "@semio/ui";
import { useOrthoCameraSetup, usePlaybackGestures, useAnimationStore } from "../../hooks";
import { TrackRender } from "../../types";
import { AnimationData } from "../../store-types";
import { ThemeMode } from "../../functions";
import { DataRenderer } from "./data-renderer";
import { SharedSplineBackground } from "./shared-spline-background";
import { HoverMarker } from "./overlays/hover-marker";
import { PlayheadMarker } from "./overlays/playhead-marker";
import { FrustumBackground } from "./frustum-background";
import { BoundsOverlay } from "./overlays/bounds-overlay";
import { TickBackground } from "./overlays/tick-background";
import { useMotionCanvas } from "./shared/motion-canvas-context";

interface TracksRendererProps {
  viewId: string;
  trackHeight?: number;
  scrollValue?: MotionValue<number>;
  topOffsetPx?: number;
  bottomOffsetPx?: number;
  emphasis?: string[];
  onEmphasisChange?: (id: string, opt: "add" | "remove") => void;
  theme?: ThemeMode;
}

export const TracksRenderer = memo(function TracksRenderer({
  viewId,
  trackHeight = 36,
  scrollValue,
  topOffsetPx = 32,
  bottomOffsetPx = 108,
  emphasis = [],
  onEmphasisChange = () => {},
  theme = Theme.Light,
}: TracksRendererProps) {
  const { size, camera } = useThree();
  const { size: motionSize } = useMotionCanvas();

  const sourceRowIds = useAnimationStore(
    useShallow((state: AnimationData) => state.editorViews[viewId].sourceRowIds),
  );

  const trackRender = useAnimationStore(
    useShallow((state: AnimationData) => state.editorViews[viewId].trackRender),
  );

  const availableHeight = size.height - topOffsetPx - bottomOffsetPx;

  useOrthoCameraSetup(camera as THREE.OrthographicCamera);

  const groupRef = useRef<THREE.Group>(null);
  const lastCalculatedSizeRef = useRef({ width: 0, height: 0 });
  const lastTrackRenderRef = useRef<TrackRender>(trackRender);
  const cachedPositionRef = useRef({ y: 0, trackWorldHeight: 0, worldHeight: 1 });

  // Compute world Y position for the top of the TracksRenderer with caching
  const calculatePosition = useCallback(() => {
    if ((camera as THREE.OrthographicCamera).isOrthographicCamera) {
      const orthoCamera = camera as THREE.OrthographicCamera;
      const worldHeight0 = orthoCamera.top - orthoCamera.bottom;
      const offsetWorld = (topOffsetPx / size.height) * worldHeight0;
      const trackWorldHeight0 = (trackHeight / size.height) * worldHeight0;

      if (trackRender === TrackRender.Spline) {
        // For spline mode, center the tracks in the available area (respecting top and bottom offsets)
        const bottomOffsetWorld = (bottomOffsetPx / size.height) * worldHeight0;
        const availableTop = orthoCamera.top - offsetWorld;
        const availableBottom = orthoCamera.bottom + bottomOffsetWorld;
        const y0: number = (availableTop + availableBottom) / 2;
        return { y: y0, trackWorldHeight: trackWorldHeight0, worldHeight: worldHeight0 };
      } else {
        // Y position is at top minus offset minus half a track (so first track is flush with HUD)
        const y0: number = orthoCamera.top - offsetWorld - trackWorldHeight0 / 2;
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

    const currentScrollPx = scrollValue?.get() ?? 0;
    const scrollChanged = Math.abs(currentScrollPx - lastScrollValueRef.current) > 0.1;
    const positionChanged =
      Math.abs(y - lastPositionRef.current.y) > 0.001 ||
      Math.abs(0 - lastPositionRef.current.z) > 0.001;
    const trackRenderChanged = trackRender !== lastFrameTrackRenderRef.current;

    // Only update position if scroll, calculated position, or trackRender mode changed
    if (scrollChanged || positionChanged || trackRenderChanged) {
      if (scrollValue && trackRender !== TrackRender.Spline) {
        const scrollWorld = (currentScrollPx / size.height) * worldHeight;
        groupRef.current.position.y = y + scrollWorld;
      } else if (scrollValue && trackRender === TrackRender.Spline) {
        // For spline mode, keep y position fixed and handle z-axis positioning
        groupRef.current.position.y = y;
      } else if (trackRender !== TrackRender.Spline) {
        // No scroll value, position at base y
        groupRef.current.position.y = y;
      } else {
        // Spline mode without scroll, position at center
        groupRef.current.position.y = y;
      }

      lastScrollValueRef.current = currentScrollPx;
      lastPositionRef.current = { y: groupRef.current.position.y, z: groupRef.current.position.z };
      lastFrameTrackRenderRef.current = trackRender;
    }
  });

  // Calculate the center Y position of the track area
  const trackAreaCenterY = useMemo(() => {
    const availableWorldHeight = (availableHeight / size.height) * worldHeight;

    if (trackRender === TrackRender.Spline) {
      return y; // Already centered for spline mode
    } else {
      // For non-spline, center of the available area
      const orthoCamera = camera as THREE.OrthographicCamera;
      const offsetWorld = (topOffsetPx / size.height) * worldHeight;
      return orthoCamera.top - offsetWorld - availableWorldHeight / 2;
    }
  }, [y, worldHeight, availableHeight, size.height, trackRender, camera, topOffsetPx]);

  // Add playback gestures for seeking and hover preview
  const playbackGestures = usePlaybackGestures();

  useMotionValueEvent(motionSize.height, "change", (height) => {
    (camera as THREE.OrthographicCamera).top = height / 2;
    (camera as THREE.OrthographicCamera).bottom = -height / 2;
    camera.updateProjectionMatrix();
  });

  useEffect(() => {
    (camera as THREE.OrthographicCamera).top = motionSize.height.get() / 2;
    (camera as THREE.OrthographicCamera).bottom = -motionSize.height.get() / 2;
    camera.updateProjectionMatrix();
  });

  return (
    <>
      <group ref={groupRef as any}>
        {sourceRowIds.map((sourceId, idx) => (
          <DataRenderer
            key={sourceId}
            viewId={viewId}
            height={trackRender === TrackRender.Spline ? availableHeight : trackHeight}
            sourceRowId={sourceId}
            yOffset={trackRender === TrackRender.Spline ? 0 : -trackWorldHeight * idx}
            // zOffset={trackRender === TrackRender.Spline ? -trackWorldHeight * idx : undefined}
            emphasis={emphasis.includes(sourceId)}
            onEmphasisChange={(v) => onEmphasisChange(sourceId, v ? "add" : "remove")}
            theme={theme}
            scrollOffset={trackRender !== TrackRender.Spline ? scrollValue : undefined}
          />
        ))}
        {trackRender === TrackRender.Spline && (
          <SharedSplineBackground
            sourceRowId={viewId}
            height={availableHeight}
            yOffset={0}
            theme={theme}
          />
        )}
      </group>

      {/* Render the hover markers and add a gesture detector */}
      <group position={[0, trackAreaCenterY, 0]}>
        <TickBackground height={availableHeight} theme={theme} />
        <HoverMarker height={availableHeight} theme={theme} />
        <PlayheadMarker height={availableHeight} theme={theme} />
        <BoundsOverlay height={availableHeight} theme={theme} />

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
