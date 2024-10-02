import { type ReactNode } from "react";
import { ParentSize } from "@visx/responsive";
import { Track } from "./track";

export function Timeline({ trackIds }: { trackIds?: string[] }): ReactNode {
  return (
    <div className="cursor-pointer items-center w-full">
      <ParentSize debounceTime={10}>
        {({ width }) => <Track width={width} trackIds={trackIds} canZoom />}
      </ParentSize>
    </div>
  );
}
