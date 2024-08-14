import { ParentSize } from "@visx/responsive";
import { Track } from "./track";

export function Minimap() {
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
            />
          );
        }}
      </ParentSize>
    </div>
  );
}

function InnerMinimap() {}
