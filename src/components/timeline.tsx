import { CSSProperties, type ReactNode } from "react";
import { ParentSize } from "@visx/responsive";
import { AnimationData } from "../store-types";
import { AnimationInstanceSettings, TrackRender } from "../types";
import { useAnimationStore } from "../hooks";
import { Track } from "./track";

export interface TimelineProps {
  animationId: string;
  trackIds?: string[];
  namespaceId: string;
  instanceSettings: AnimationInstanceSettings;
  trackRender: TrackRender.Key | TrackRender.Preview | TrackRender.Transition;
  height?: number;
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
  height = 30,
}: TimelineProps): ReactNode {
  const color = useAnimationStore((state: AnimationData) => {
    if (trackIds === undefined || trackIds?.length === 0 || trackIds?.length > 1) return "#737373";
    const track = state.tracks[trackIds[0]];
    return track?.settings?.color || "#737373";
  });
  return (
    <div
      className="cursor-pointer items-center w-full"
      style={{ "--track-color": color } as CSSProperties}
    >
      <ParentSize debounceTime={10}>
        {({ width }) => (
          <Track
            width={width}
            trackIds={trackIds}
            canZoom
            animationId={animationId}
            namespaceId={namespaceId}
            trackRender={trackRender}
            instanceSettings={instanceSettings}
            showFullLine
            height={height}
          />
        )}
      </ParentSize>
    </div>
  );
}
