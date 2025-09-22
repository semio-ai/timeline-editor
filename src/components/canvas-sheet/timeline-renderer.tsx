import { memo, useMemo } from "react";
import { useShallow } from "zustand/shallow";
import { Theme } from "@semio/ui";
import { usePlaybackGestures, useAnimationStore } from "../../hooks";
import { AnimationData } from "../../store-types";
import { DataRenderer } from "./data-renderer";
import { HoverMarker } from "./overlays/hover-marker";
import { PlayheadMarker } from "./overlays/playhead-marker";
import { FrustumBackground } from "./frustum-background";
import { BoundsOverlay } from "./overlays/bounds-overlay";
import { TickBackground } from "./overlays/tick-background";

export interface TimelineRendererProps {
  viewId: string;
  theme?: Theme.Light | Theme.Dark;
}

export const TimelineRenderer = memo(function TimelineRenderer({
  viewId,
  theme = Theme.Light,
}: TimelineRendererProps) {
  const sourceRow = useAnimationStore(
    useShallow((state: AnimationData) => state.instancedTrackSources[viewId]),
  );

  // Add playback gestures for seeking and hover preview
  const playbackGestures = usePlaybackGestures();

  return (
    <>
      <TickBackground height={36} theme={theme} />
      <HoverMarker height={36} theme={theme} />
      <PlayheadMarker height={36} theme={theme} />
      <BoundsOverlay height={36} theme={theme} />
      <DataRenderer
        height={36}
        viewId={viewId}
        sourceRowId={viewId}
        theme={theme}
        measureFromBottom
        showBackground={false}
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
