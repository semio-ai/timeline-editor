import { type ReactNode } from "react";
import { DEFAULT_TRACK_HEIGHT, TIMELINE_PADDING } from "../constants";
import { AnimationInstanceSettings, TrackRender } from "../types";
import { TrackVisualizer } from "./track-visualizer";

export interface TimelineProps {
  animationId: string;
  trackIds?: string[];
  namespaceId: string;
  instanceSettings: AnimationInstanceSettings;
  trackRender: TrackRender.Key | TrackRender.Preview | TrackRender.Transition;
  height?: number;
  width?: number;
}

/**
 * Timeline Component that renders a track that visualizes all data for the tracks specified.
 * @param animationId - The id of the animation to render.
 * @param trackIds - The ids of the tracks to render. If empty, it displays all tracks.
 * @param namespace - The namespace of the animation to render.
 * @param trackRender - The render type for the track.
 */
export function Timeline({
  animationId,
  trackIds,
  namespaceId,
  instanceSettings,
  trackRender,
  height = DEFAULT_TRACK_HEIGHT,
  width = 2 * TIMELINE_PADDING,
}: TimelineProps): ReactNode {
  return (
    <TrackVisualizer
      width={width}
      trackIds={trackIds}
      canZoom
      animationId={animationId}
      namespaceId={namespaceId}
      trackRender={trackRender}
      instanceSettings={instanceSettings}
      showFullLine
      showBackground={false}
      height={height}
    />
  );
}
