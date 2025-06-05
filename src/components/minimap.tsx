import { AnimationInstanceSettings, TrackRender } from "../types";
import { TIMELINE_PADDING } from "../constants";
import { TrackVisualizer } from "./track-visualizer";

export function Minimap({
  animationId,
  instanceSettings,
  height = 32,
  width = 2 * TIMELINE_PADDING,
}: {
  animationId: string;
  instanceSettings: AnimationInstanceSettings;
  height?: number;
  width?: number;
}) {
  return (
    <TrackVisualizer
      showData={false}
      canZoom={false}
      height={height}
      width={width}
      trackIds={[]}
      showZoomControls
      showBackground={false}
      animationId={animationId}
      namespaceId="default"
      trackRender={TrackRender.Key}
      instanceSettings={instanceSettings}
    />
  );
}
