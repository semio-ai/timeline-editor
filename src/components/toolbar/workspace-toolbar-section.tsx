import { memo, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Dropdown,
  Icon,
  NestedItem,
  NestedLabel,
  NestedRadio,
  Size,
  TextField,
} from "@semio/ui";
import { useShallow } from "zustand/shallow";
import { clsx } from "clsx";
import { useAnimationStore } from "../../hooks";
import { ToolbarTooltipButton } from "./toolbar-tooltip-button";

export interface WorkspaceToolbarSectionProps {
  viewIds: string[];
  activeViewId: string;
  onSelectView: (viewId: string) => void;
  onCreateView: () => void;
  onCopyView: (viewId: string) => void;
  onRemoveView: (viewId: string) => void;
  onToggleExpand?: (expanded: boolean) => void;
  expanded?: boolean;
}

export const WorkspaceToolbarSection = memo(function WorkspaceToolbarSection({
  viewIds,
  activeViewId,
  onSelectView,
  onCreateView,
  onCopyView,
  onRemoveView,
  onToggleExpand,
  expanded,
}: WorkspaceToolbarSectionProps) {
  const [editingViewId, setEditingViewId] = useState<string | null>(null);
  const [activeWorkspaceDraftName, setActiveWorkspaceDraftName] = useState("");
  const editingInputRef = useRef<HTMLInputElement | null>(null);

  const { editorViews, updateView } = useAnimationStore(
    useShallow((state) => ({
      editorViews: state.editorViews,
      updateView: state.updateView,
    })),
  );

  const resolvedViews = useMemo(
    () =>
      viewIds.flatMap((id, index) => {
        const view = editorViews[id];
        if (!view) return [];
        return [{ id, label: view.name ?? `View ${String(index + 1)}` }];
      }),
    [editorViews, viewIds],
  );

  const activeViewLabel = useMemo(() => {
    const active = resolvedViews.find((view) => view.id === activeViewId);
    return active?.label ?? "View";
  }, [activeViewId, resolvedViews]);

  const isEditingActiveWorkspace = editingViewId !== null;

  const focusEditingInput = useCallback(() => {
    const input = editingInputRef.current;
    if (!input) return;
    input.focus();
    const cursorPosition = input.value.length;
    input.setSelectionRange(cursorPosition, cursorPosition);
  }, []);

  const commitWorkspaceRename = useCallback(
    (commit = true) => {
      if (!editingViewId) return;
      if (commit) {
        const nextName = activeWorkspaceDraftName.trim();
        updateView(editingViewId, { name: nextName.length > 0 ? nextName : undefined });
      } else {
        const editingView = resolvedViews.find((view) => view.id === editingViewId);
        setActiveWorkspaceDraftName(editingView?.label ?? activeViewLabel);
      }
      setEditingViewId(null);
    },
    [activeViewLabel, activeWorkspaceDraftName, editingViewId, resolvedViews, updateView],
  );

  const beginActiveWorkspaceRename = useCallback(() => {
    if (!activeViewId) return;
    setEditingViewId(activeViewId);
    setActiveWorkspaceDraftName(activeViewLabel);
  }, [activeViewId, activeViewLabel]);

  const handleSelectView = useCallback(
    (viewId: string) => {
      commitWorkspaceRename(true);
      onSelectView(viewId);
    },
    [commitWorkspaceRename, onSelectView],
  );

  useEffect(() => {
    if (!isEditingActiveWorkspace) return;
    const frameId = window.requestAnimationFrame(() => {
      focusEditingInput();
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [focusEditingInput, isEditingActiveWorkspace]);

  useEffect(() => {
    if (isEditingActiveWorkspace) return;
    setActiveWorkspaceDraftName(activeViewLabel);
  }, [activeViewLabel, isEditingActiveWorkspace]);

  const triggerElement: ReactNode = useMemo(() => {
    return (
      <div className="flex flex-1 items-center gap-0.5 bg-neutral-500/10 pl-0.5 hover:bg-neutral-500/25">
        <TextField
          ref={isEditingActiveWorkspace ? editingInputRef : undefined}
          readOnly={!isEditingActiveWorkspace}
          size={Size.Sm}
          value={activeWorkspaceDraftName}
          onChange={(value) => setActiveWorkspaceDraftName(value)}
          onBlur={() => {
            if (isEditingActiveWorkspace) {
              commitWorkspaceRename(true);
            }
          }}
          onKeyDown={(event) => {
            if (!isEditingActiveWorkspace) return;
            event.stopPropagation();
            if (event.key === "Enter") {
              event.preventDefault();
              commitWorkspaceRename(true);
            } else if (event.key === "Escape") {
              event.preventDefault();
              commitWorkspaceRename(false);
            }
          }}
          outline="hidden"
          className={clsx(
            "rounded-r-none bg-transparent hover:bg-transparent",
            !isEditingActiveWorkspace && "pointer-events-none",
          )}
          wrapperClassName="flex-1 min-w-0"
        />
        <Button
          visuals="inverted"
          size={Size.Sm}
          altText="Select Workspace"
          leftIcon="select-indicator"
          className={isEditingActiveWorkspace ? "pointer-events-none" : ""}
        />
      </div>
    );
  }, [activeWorkspaceDraftName, commitWorkspaceRename, isEditingActiveWorkspace]);

  return (
    <div className="variant-scope variant-responsive-persistent-outline toolbar-segments flex flex-1 gap-0.5 rounded-sm p-0.5">
      <ToolbarTooltipButton
        tooltip="Toggle Workspace Expansion"
        visuals="inverted"
        size={Size.Sm}
        onClick={() => onToggleExpand?.(!(expanded ?? false))}
        altText="Expand Tracks"
        leftIcon={
          <Icon
            name="workspace-toggle"
            className={clsx(
              expanded ? "rotate-0" : "rotate-180",
              "transition-transform duration-75 ease-in-out",
            )}
          />
        }
        className="rounded-l-xs bg-neutral-500/10 hover:bg-neutral-500/25"
      />

      {isEditingActiveWorkspace ? (
        triggerElement
      ) : (
        <Dropdown
          side="top"
          onTriggerDoubleClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            beginActiveWorkspaceRename();
          }}
          trigger={triggerElement}
        >
          <NestedLabel>Select Workspace</NestedLabel>
          <NestedRadio
            value={activeViewId}
            onChange={(viewId) => {
              handleSelectView(viewId);
            }}
            options={resolvedViews.map((view) => ({
              value: view.id,
              label: view.label,
            }))}
          />
        </Dropdown>
      )}

      <Dropdown
        side="top"
        trigger={
          <ToolbarTooltipButton
            tooltip="Workspace Options"
            visuals="inverted"
            size={Size.Sm}
            altText="Workspace Options"
            leftIcon={<Icon name="menu" />}
            className="rounded-r-xs bg-neutral-500/10 hover:bg-neutral-500/25"
          />
        }
      >
        <NestedLabel>Workspace Options</NestedLabel>
        <NestedItem
          left={<Icon name="rename" />}
          onClick={() => {
            beginActiveWorkspaceRename();
          }}
        >
          Rename Workspace
        </NestedItem>
        <NestedItem
          left={<Icon name="copy" />}
          onClick={() => {
            if (activeViewId) {
              onCopyView(activeViewId);
            }
          }}
        >
          Copy Workspace
        </NestedItem>
        <NestedItem
          left={<Icon name="delete" />}
          disabled={viewIds.length <= 1}
          onClick={() => {
            if (activeViewId) {
              onRemoveView(activeViewId);
            }
          }}
        >
          Delete Workspace
        </NestedItem>
        <NestedItem
          left={<Icon name="add" />}
          onClick={() => {
            onCreateView();
          }}
          testId="workspace-new-default"
        >
          New Default Workspace
        </NestedItem>
      </Dropdown>
    </div>
  );
});
