import { useThree, useFrame } from "@react-three/fiber";
import { useRef, useMemo } from "react";
import type { MotionValue } from "motion";
import * as THREE from "three";
import { Theme } from "@semio/ui";
import { useOrthoCameraSetup } from "../../../hooks";
import { AnimationInstanceSettings, TrackRender } from "../../../types";
import { ThemeMode } from "../../../functions";
import { DataRenderer } from "./data-renderer";

interface TrackListProps {
  animationId: string; // Unique ID for the animation
  namespaceId: string; // Namespace for the animation, used for scoping
  instanceSettings: AnimationInstanceSettings; // Settings for the animation instance
  tracks?: string[];
  trackHeight?: number;
  scrollValue?: MotionValue<number>;
  topOffsetPx?: number;
  bottomOffsetPx?: number;
  emphasis?: string[];
  onEmphasisChange?: (id: string, opt: "add" | "remove") => void;
  theme?: ThemeMode;
  trackRender?: TrackRender;
}

export function TrackList({
  animationId,
  namespaceId,
  instanceSettings = { timescale: 1, offset: 0, active: true },
  tracks = [],
  trackHeight = 36,
  scrollValue,
  topOffsetPx = 32,
  bottomOffsetPx = 108,
  emphasis = [],
  onEmphasisChange = () => {},
  theme = Theme.Light,
  trackRender = TrackRender.Key,
}: TrackListProps) {
  const { size, camera } = useThree();

  const availableHeight = size.height - topOffsetPx - bottomOffsetPx;

  useOrthoCameraSetup(camera as THREE.OrthographicCamera);

  const groupRef = useRef<THREE.Group>(null);

  // Compute world Y position for the top of the TrackList
  const [y, trackWorldHeight, worldHeight] = useMemo(() => {
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
        return [y0, trackWorldHeight0, worldHeight0];
      } else {
        // Y position is at top minus offset minus half a track (so first track is flush with HUD)
        const y0: number = orthoCamera.top - offsetWorld - trackWorldHeight0 / 2;
        return [y0, trackWorldHeight0, worldHeight0];
      }
    } else {
      return [0, trackHeight, 1];
    }
  }, [camera, size, topOffsetPx, bottomOffsetPx, trackHeight, trackRender]);

  // Imperatively update group position based on scrollValue
  useFrame(() => {
    if (groupRef.current && scrollValue && trackRender !== TrackRender.Spline) {
      const scrollPx = scrollValue.get();
      const scrollWorld = (scrollPx / size.height) * worldHeight;
      groupRef.current.position.y = y + scrollWorld;
    } else if (groupRef.current && scrollValue && trackRender === TrackRender.Spline) {
      // For spline mode, keep y position fixed and handle z-axis positioning
      groupRef.current.position.y = y;
      const scrollPx = scrollValue.get();
      const scrollWorld = (scrollPx / size.height) * worldHeight;
      // Apply scroll to z-axis for spline mode
      groupRef.current.position.z = scrollWorld;
    } else if (groupRef.current && trackRender !== TrackRender.Spline) {
      // No scroll value, position at base y
      groupRef.current.position.y = y;
    } else if (groupRef.current && trackRender === TrackRender.Spline) {
      // Spline mode without scroll, position at center
      groupRef.current.position.y = y;
      groupRef.current.position.z = 0;
    }
  });

  return (
    <group ref={groupRef as any}>
      {tracks.map((track, idx) => (
        <DataRenderer
          animationId={animationId}
          namespaceId={namespaceId}
          instanceSettings={instanceSettings}
          key={track}
          height={trackRender === TrackRender.Spline ? availableHeight : trackHeight}
          trackIds={[track]}
          yOffset={trackRender === TrackRender.Spline ? 0 : -trackWorldHeight * idx}
          zOffset={trackRender === TrackRender.Spline ? -trackWorldHeight * idx : undefined}
          emphasis={emphasis.includes(track)}
          onEmphasisChange={(v) => onEmphasisChange(track, v ? "add" : "remove")}
          theme={theme}
          scrollOffset={trackRender !== TrackRender.Spline ? scrollValue : undefined}
          trackRender={trackRender}
        />
      ))}
    </group>
  );
}
