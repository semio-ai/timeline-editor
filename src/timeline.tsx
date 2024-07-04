import { type ReactNode } from "react";
import { ParentSize } from "@visx/responsive";
import { Scrubber } from "./scrubber";

export function Timeline(): ReactNode {
  // const [editorOpened, { toggle: openEditorToggle }] = useDisclosure();

  return (
    <div className="cursor-pointer flex-1 flex items-center">
      <ParentSize debounceTime={10}>
        {({ width }) => <Scrubber editorOpened={false} width={width} />}
      </ParentSize>
    </div>
  );
}
