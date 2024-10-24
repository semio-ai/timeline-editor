import { ParentSize } from "@visx/responsive";
import { Track } from "./track";

export function Minimap({ animationId }: { animationId: string }) {
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
            />
          );
        }}
      </ParentSize>
    </div>
  );
}
