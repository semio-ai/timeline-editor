import { memo, useMemo } from "react";
import { Theme } from "@semio/ui";
import { usePlaybackGestures } from "../../../hooks";
import { Source } from "../../../types";
import { DataRenderer } from "./data-renderer";
import { HoverMarker } from "./overlays/hover-marker";
import { PlayheadMarker } from "./overlays/playhead-marker";
import { FrustumBackground } from "./frustum-background";
import { BoundsOverlay } from "./overlays/bounds-overlay";
import { TickBackground } from "./overlays/tick-background";

export interface TimelineRendererProps {
  filter: string[];
  sources: Source[];
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
  sources = [],
  filter = [],
  animationId,
  namespaceId,
  instanceSettings = { timescale: 1, offset: 0, active: true },
  theme = Theme.Light,
}: TimelineRendererProps) {
  // Add playback gestures for seeking and hover preview
  const playbackGestures = usePlaybackGestures();

  const filteredSources = useMemo(() => {
    return sources.filter((source) => filter.includes(source.trackId));
  }, [sources, filter]);

  return (
    <>
      <TickBackground height={36} theme={theme} />
      <HoverMarker height={36} theme={theme} />
      <PlayheadMarker height={36} theme={theme} />
      <BoundsOverlay height={36} theme={theme} />
      <DataRenderer
        height={36}
        sources={filteredSources}
        animationId={animationId}
        namespaceId={namespaceId}
        instanceSettings={instanceSettings}
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
