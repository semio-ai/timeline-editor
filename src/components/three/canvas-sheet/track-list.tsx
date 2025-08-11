import { useThree, useFrame, ThreeEvent } from "@react-three/fiber";
import { useRef, useMemo, useCallback } from "react";
import type { MotionValue } from "motion";
import * as THREE from "three";
import { useOrthoCameraSetup } from "../../../hooks";
import { AnimationInstanceSettings } from "../../../types";
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
}: TrackListProps) {
  const { size, camera } = useThree();

  useOrthoCameraSetup(camera as THREE.OrthographicCamera);

  const groupRef = useRef<THREE.Group>(null);

  // Calculate scroll boundaries
  const totalContentHeightPx = tracks.length * trackHeight;
  const visibleHeightPx = size.height - topOffsetPx - bottomOffsetPx;
  const scrollMin = 0;
  const scrollMax = Math.max(0, totalContentHeightPx - visibleHeightPx);

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

  // Wheel handler to update scrollValue
  const handleWheel = useCallback(
    (e: ThreeEvent<WheelEvent>) => {
      // Ignore if Control or Command/Meta key is pressed
      if (e.ctrlKey || e.metaKey) return;
      if (!scrollValue) return;
      e.stopPropagation();
      const prev = scrollValue.get();
      let next = prev + e.deltaY;
      next = Math.max(scrollMin, Math.min(scrollMax, next));
      scrollValue.set(next);
    },
    [scrollValue, scrollMin, scrollMax],
  );

  return (
    <group ref={groupRef as any} onWheel={handleWheel as any}>
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
        />
      ))}
    </group>
  );
}
