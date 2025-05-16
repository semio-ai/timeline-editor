import useMeasure from "react-use-measure";
import { AnimationInstanceSettings, TrackRender } from "../types";
import { Track } from "./track";

export function Minimap({
  animationId,
  instanceSettings,
}: {
  animationId: string;
  instanceSettings: AnimationInstanceSettings;
}) {
  const [boundRef, bounds] = useMeasure();
  return (
    <div ref={boundRef} className="flex-1 w-full">
      <Track
        showData={false}
        canZoom={false}
        height={32}
        width={bounds.width}
        trackIds={[]}
        showZoomControls
        animationId={animationId}
        namespaceId="default"
        trackRender={TrackRender.Key}
        instanceSettings={instanceSettings}
      />
    </div>
  );
}
