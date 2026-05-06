import { memo } from "react";
import { KeyToolbarSection } from "./toolbar/key-toolbar-section";
import { ToolbarWrapper } from "./toolbar/toolbar-wrapper";
import { ViewToolbarSection } from "./toolbar/view-toolbar-section";
import { ViewportToolbarSection } from "./toolbar/viewport-toolbar-section";

export interface ToolbarProps {
  viewId: string;
  viewIds: string[];
  onSelectView: (viewId: string) => void;
  onCreateView: () => void;
  onCopyView: (viewId: string) => void;
  onRemoveView: (viewId: string) => void;
  onToggleExpand?: (expanded: boolean) => void;
  expanded?: boolean;
}

export const Toolbar = memo(function Toolbar({ viewId }: ToolbarProps) {
  return (
    <ToolbarWrapper leftPadding={1}>
      <ViewToolbarSection viewId={viewId} />
      <KeyToolbarSection />
      <ViewportToolbarSection viewId={viewId} />
    </ToolbarWrapper>
  );
});
