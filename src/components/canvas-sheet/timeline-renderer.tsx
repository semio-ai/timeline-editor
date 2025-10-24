import { memo } from "react";
import { Theme } from "@semio/ui";
import { usePlaybackGestures } from "../../hooks";
import { TrackRender } from "../../types";
import { Z } from "../../constants";
import { DataRenderer } from "./data-renderer";
import { HoverMarker } from "./overlays/hover-marker";
import { PlayheadMarker } from "./overlays/playhead-marker";
import { FrustumBackground } from "./frustum-background";
import { BoundsOverlay } from "./overlays/bounds-overlay";
import { TickBackground } from "./overlays/tick-background";

export interface TimelineRendererProps {
  theme?: Theme.Light | Theme.Dark;
}

export const TimelineRenderer = memo(function TimelineRenderer({
  theme = Theme.Light,
}: TimelineRendererProps) {
  // Add playback gestures for seeking and hover preview
  const playbackGestures = usePlaybackGestures();

  return (
    <>
      <mesh position={[0.5, 0, Z.ForegroundBackgroundBoundary]}>
        <planeGeometry args={[1.1, 36]} />
        <meshBasicMaterial
          color={theme === Theme.Dark ? "#000000" : "#000000"}
          transparent
          opacity={0.4}
        />
      </mesh>
      <mesh position={[0.5, 0, Z.SelectedUnselectedBoundary]}>
        <planeGeometry args={[1.1, 36]} />
        <meshBasicMaterial
          color={theme === Theme.Dark ? "#000000" : "#FFFFFF"}
          transparent
          opacity={0.3}
        />
      </mesh>
      <TickBackground height={36} theme={theme} />
      <HoverMarker height={36} theme={theme} />
      <PlayheadMarker height={36} theme={theme} />
      <BoundsOverlay height={36} theme={theme} />
      <DataRenderer
        height={36}
        sourceRowId="global"
        theme={theme}
        measureFromBottom
        showBackground={false}
        trackRender={TrackRender.Key}
      />
      <FrustumBackground
        height={36}
        visibility="transparent"
        z={-0.5}
        pointerEvents={playbackGestures}
      />
    </>
  );
});
