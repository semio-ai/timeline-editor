import { memo, useEffect } from "react";
import { Theme } from "@semio/ui";
import { useThree } from "@react-three/fiber";
import { useShallow } from "zustand/shallow";
import { useMotionValue } from "motion/react";
import { usePlaybackGestures } from "../../../hooks";
import { DataRenderer } from "./data-renderer";
import { HoverMarker } from "./playback-gizmos/hover-marker";

export interface TimelineRendererProps {
  selection?: string[];
  animationId: string;
  namespaceId: string;
  instanceSettings?: {
    timescale: number;
    offset: number;
    active: boolean;
  };
  theme?: Theme.Light | Theme.Dark;
}

export const TimelineRenderer = memo(function TimelineRenderer({
  selection,
  animationId,
  namespaceId,
  instanceSettings = { timescale: 1, offset: 0, active: true },
  theme = Theme.Light,
}: TimelineRendererProps) {
  const size = useThree(useShallow((t) => t.size));

  const timelineOffset = useMotionValue(size.height / 2);

  // Add playback gestures for seeking and hover preview
  const playbackGestures = usePlaybackGestures();

  useEffect(() => {
    timelineOffset.set(size.height / 2);
  }, [size.height, timelineOffset]);

  return (
    <>
      <HoverMarker height={36} theme={theme} />
      <DataRenderer
        height={36}
        trackIds={selection}
        animationId={animationId}
        namespaceId={namespaceId}
        instanceSettings={instanceSettings}
        theme={theme}
        scrollOffset={timelineOffset}
        measureFromBottom
      />
      <mesh {...playbackGestures} position={[0.5, 0, -0.5]}>
        <planeGeometry args={[1, 36]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
    </>
  );
});
