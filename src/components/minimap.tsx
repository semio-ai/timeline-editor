import { ParentSize } from "@visx/responsive";
import { AnimationInstanceSettings, TrackRender } from "../types";
import { Track } from "./track";

export function Minimap({
  animationId,
  instanceSettings,
}: {
  animationId: string;
  instanceSettings: AnimationInstanceSettings;
}) {
  return (
    <div className="flex-1">
      <ParentSize debounceTime={10}>
        {({ width }) => {
          return (
            <Track
              showData={false}
              showBackground={false}
              canZoom={false}
              width={width}
              trackIds={[]}
              showZoomControls
              animationId={animationId}
              namespaceId="default"
              trackRender={TrackRender.Key}
              instanceSettings={instanceSettings}
            />
          );
        }}
      </ParentSize>
    </div>
  );
}
