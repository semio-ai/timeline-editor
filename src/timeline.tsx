import { type ReactNode } from "react";
import { ParentSize } from "@visx/responsive";
import { Scrubber } from "./scrubber";

export function Timeline(): ReactNode {
  return (
    <div className="cursor-pointer items-center w-full">
      <ParentSize debounceTime={10}>
        {({ width }) => <Scrubber editorOpened={false} width={width} />}
      </ParentSize>
    </div>
  );
}
