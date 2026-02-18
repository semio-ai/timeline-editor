import { memo } from "react";
import { KeyToolbarSection } from "./toolbar/key-toolbar-section";
import { ToolbarLeftSection } from "./toolbar/toolbar-left-section";
import { ToolbarRightSection } from "./toolbar/toolbar-right-section";

export interface ToolbarProps {
  viewId: string;
  onToggleExpand?: (expanded: boolean) => void;
  expanded?: boolean;
}

export const Toolbar = memo(function Toolbar({ viewId, onToggleExpand, expanded }: ToolbarProps) {
  return (
    <div className="flex flex-1 flex-row h-9 items-center justify-between pl-1.5 pr-1 col-span-2">
      <div className="flex gap-2">
        <ToolbarLeftSection viewId={viewId} onToggleExpand={onToggleExpand} expanded={expanded} />
      </div>
      <div className="flex gap-2">
        <KeyToolbarSection />
      </div>
      <div className="flex gap-2">
        <ToolbarRightSection />
      </div>
    </div>
  );
});
