import { useThree, useFrame } from "@react-three/fiber";
import { useRef, useMemo } from "react";
import type { MotionValue } from "motion";
import * as THREE from "three";
import { Theme } from "@semio/ui";
import { useOrthoCameraSetup } from "../../../hooks";
import { AnimationInstanceSettings } from "../../../types";
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
}

export function TrackList({
  animationId,
  namespaceId,
  instanceSettings = { timescale: 1, offset: 0, active: true },
  tracks = [],
  trackHeight = 36,
  scrollValue,
  topOffsetPx = 32,
  emphasis = [],
  onEmphasisChange = () => {},
  theme = Theme.Light,
}: TrackListProps) {
  const { size, camera } = useThree();

  useOrthoCameraSetup(camera as THREE.OrthographicCamera);

  const groupRef = useRef<THREE.Group>(null);

  // Compute world Y position for the top of the TrackList
  const [y, trackWorldHeight, worldHeight] = useMemo(() => {
    if ((camera as THREE.OrthographicCamera).isOrthographicCamera) {
      const orthoCamera = camera as THREE.OrthographicCamera;
      const worldHeight0 = orthoCamera.top - orthoCamera.bottom;
      const offsetWorld = (topOffsetPx / size.height) * worldHeight0;
      const trackWorldHeight0 = (trackHeight / size.height) * worldHeight0;
      // Y position is at top minus offset minus half a track (so first track is flush with HUD)
      const y0: number = orthoCamera.top - offsetWorld - trackWorldHeight0 / 2;
      return [y0, trackWorldHeight0, worldHeight0];
    } else {
      return [0, trackHeight, 1];
    }
  }, [camera, size, topOffsetPx, trackHeight]);

  // Imperatively update group position based on scrollValue
  useFrame(() => {
    if (groupRef.current && scrollValue) {
      const scrollPx = scrollValue.get();
      const scrollWorld = (scrollPx / size.height) * worldHeight;
      groupRef.current.position.y = y + scrollWorld;
    }
  });

  // Removed wheel handler; vertical scroll is now handled by PanZoomControls.

  return (
    <group ref={groupRef as any}>
      {tracks.map((track, idx) => (
        <DataRenderer
          animationId={animationId}
          namespaceId={namespaceId}
          instanceSettings={instanceSettings}
          key={track}
          height={trackHeight}
          trackIds={[track]}
          offset={-trackWorldHeight * idx}
          emphasis={emphasis.includes(track)}
          onEmphasisChange={(v) => onEmphasisChange(track, v ? "add" : "remove")}
          theme={theme}
        />
      ))}
    </group>
  );
}
