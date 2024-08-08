import { type ReactNode } from "react";
import { ParentSize } from "@visx/responsive";
import { Track } from "./track";
import { TrackControl } from "./track-control";

export function TrackRow({
  trackIds,
  isTop,
  isBottom,
}: {
  trackIds?: string[];
  isTop?: boolean;
  isBottom?: boolean;
}): ReactNode {
  return (
    <div className="flex flex-row items-center">
      <div className="w-[calc(100vw-40px)] xs:w-64 transition-[width] flex flex-row">
        <TrackControl trackIds={trackIds} color="#737373" />
        <div className="flex-1">
          {isTop ? "T" : ""} {isBottom ? "B" : ""}
        </div>
      </div>
      <div className="cursor-pointer items-center flex-1">
        <ParentSize debounceTime={10}>
          {({ width }) => (
            <Track
              width={width}
              trackIds={trackIds}
              isTop={isTop}
              isBottom={isBottom}
            />
          )}
        </ParentSize>
      </div>
    </div>
  );
}
