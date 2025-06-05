import { type ReactNode, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { DEFAULT_TRACK_HEIGHT, TIMELINE_PADDING } from "../constants";
import type { AnimationData } from "../store-types";
import { TrackRender, AnimationInstanceSettings } from "../types";
import { useAnimationStore } from "../hooks";
import { ControlWidget } from "./control-widget";
import { TrackVisualizer } from "./track-visualizer";

export function TrackRow({
  trackIds,
  animationId,
  namespaceId,
  instanceSettings,
  trackRender,
  height = DEFAULT_TRACK_HEIGHT,
  width = 2 * TIMELINE_PADDING,
}: {
  trackIds?: string[];
  animationId: string;
  namespaceId: string;
  instanceSettings: AnimationInstanceSettings;
  trackRender: TrackRender;
  height?: number;
  width?: number;
}): ReactNode {
  const [expanded, setExpanded] = useState(false);
  const [emphasis, setEmphasis] = useState(false);

  const track: string = trackIds?.[0] ?? "all";

  const trackObject = useAnimationStore(
    useShallow((state: AnimationData) => {
      if (track && track !== "all") {
        return state.tracks[track];
      } else {
        return undefined;
      }
    }),
  );

  if (!trackObject) {
    return null;
  }

  return (
    <>
      <ControlWidget
        animationId={animationId}
        animatableId={trackObject.animatableId}
        namespace={namespaceId}
        instanceSettings={instanceSettings}
        onExpandedChange={setExpanded}
        emphasis={emphasis}
        onEmphasisChange={setEmphasis}
      />
      {expanded ? (
        <div className="flex-1 flex flex-col">
          <TrackVisualizer
            animationId={animationId}
            namespaceId={namespaceId}
            instanceSettings={instanceSettings}
            width={width}
            trackIds={trackIds}
            useCustomColor
            canZoom
            highlighted={emphasis}
            onHighlightChange={setEmphasis}
            trackRender={trackRender}
            height={height}
          />
          <TrackVisualizer
            animationId={animationId}
            namespaceId={namespaceId}
            instanceSettings={instanceSettings}
            attribute="x"
            width={width}
            trackIds={trackIds}
            useCustomColor
            canZoom
            highlighted={emphasis}
            onHighlightChange={setEmphasis}
            trackRender={trackRender}
            height={height}
          />
          <TrackVisualizer
            animationId={animationId}
            namespaceId={namespaceId}
            instanceSettings={instanceSettings}
            attribute="y"
            width={width}
            trackIds={trackIds}
            useCustomColor
            canZoom
            highlighted={emphasis}
            onHighlightChange={setEmphasis}
            trackRender={trackRender}
            height={height}
          />
          <TrackVisualizer
            animationId={animationId}
            namespaceId={namespaceId}
            instanceSettings={instanceSettings}
            attribute="z"
            width={width}
            trackIds={trackIds}
            useCustomColor
            canZoom
            highlighted={emphasis}
            onHighlightChange={setEmphasis}
            trackRender={trackRender}
            height={height}
          />
        </div>
      ) : (
        <TrackVisualizer
          animationId={animationId}
          namespaceId={namespaceId}
          instanceSettings={instanceSettings}
          width={width}
          trackIds={trackIds}
          useCustomColor
          canZoom
          highlighted={emphasis}
          onHighlightChange={setEmphasis}
          trackRender={trackRender}
          height={height}
        />
      )}
    </>
  );
}
