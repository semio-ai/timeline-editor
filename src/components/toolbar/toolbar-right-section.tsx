import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dropdown, NestedItem, NestedLabel, NestedSeparator, Size, TextField } from "@semio/ui";
import { useShallow } from "zustand/shallow";
import {
  IconCopy,
  IconEdit,
  IconLayout2,
  IconPlus,
  IconPoint,
  IconPointFilled,
  IconTrash,
} from "@tabler/icons-react";
import { clsx } from "clsx";
import { useAnimationStore } from "../../hooks";
import { ToolbarTooltipButton } from "./toolbar-tooltip-button";

export interface ToolbarRightSectionProps {
  viewIds: string[];
  activeViewId: string;
  onSelectView: (viewId: string) => void;
  onCreateView: () => void;
  onCopyView: (viewId: string) => void;
  onRemoveView: (viewId: string) => void;
}

export const ToolbarRightSection = memo(function ToolbarRightSection({
  viewIds,
  activeViewId,
  onSelectView,
  onCreateView,
  onCopyView,
  onRemoveView,
}: ToolbarRightSectionProps) {
  const [editingViewId, setEditingViewId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
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

  const finishEditing = useCallback(
    (commit = true) => {
      if (editingViewId && commit) {
        const nextName = draftName.trim();
        updateView(editingViewId, { name: nextName.length > 0 ? nextName : undefined });
      }
      setEditingViewId(null);
      setDraftName("");
    },
    [draftName, editingViewId, updateView],
  );

  const beginEditing = useCallback((viewId: string, label: string) => {
    setEditingViewId(viewId);
    setDraftName(label);
  }, []);

  useEffect(() => {
    if (!editingViewId) return;
    editingInputRef.current?.focus();
    editingInputRef.current?.setSelectionRange(
      editingInputRef.current.value.length,
      editingInputRef.current.value.length,
    );
  }, [editingViewId]);

  const handleSelectView = useCallback(
    (viewId: string) => {
      finishEditing(true);
      onSelectView(viewId);
    },
    [finishEditing, onSelectView],
  );

  return (
    <div className="rounded-sm flex responsive variant-responsive-persistent-outline gap-0.5 p-0.5">
      <Dropdown
        side="top"
        matchTriggerWidth={false}
        contentClassName="desktop:w-[24rem] max-w-[calc(var(--radix-dropdown-menu-content-available-width)-4px)]"
        onOpenChange={(open) => {
          if (!open) {
            finishEditing(true);
          }
        }}
        trigger={
          <ToolbarTooltipButton
            tooltip="Manage views: switch, copy, rename, create, and remove"
            visuals="inverted"
            size={Size.Sm}
            leftIcon={<IconLayout2 className="h-3/5 aspect-square" />}
            altText={`Active view: ${activeViewLabel}`}
            className="bg-neutral-500/10 hover:bg-neutral-500/25 rounded-xs min-w-44"
          >
            {activeViewLabel}
          </ToolbarTooltipButton>
        }
      >
        <NestedLabel>Active View</NestedLabel>
        {resolvedViews.map((view) => {
          const isEditing = editingViewId === view.id;
          const isActive = activeViewId === view.id;
          return (
            <div
              key={view.id}
              role="button"
              tabIndex={0}
              className={clsx(
                "leading-none flex items-center rounded-xs group/item",
                "h-7 text-sm px-[5px] relative pl-[30px] w-full text-left select-none outline-hidden cursor-pointer",
                "responsive highlight-list-item",
                isActive && "bg-neutral-500/15",
              )}
              onClick={() => {
                if (!isEditing) {
                  handleSelectView(view.id);
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  if (!isEditing) {
                    handleSelectView(view.id);
                  }
                }
              }}
            >
              <span
                className={clsx(
                  "absolute left-1 inline-flex items-center justify-center",
                  "responsive check-indicator",
                  !isActive && "opacity-40",
                )}
              >
                {isActive ? (
                  <IconPointFilled className="h-3/4 aspect-square" />
                ) : (
                  <IconPoint className="h-3/4 aspect-square" />
                )}
              </span>
              <span className="flex min-w-0 flex-1 items-center gap-1">
                <TextField
                  ref={editingInputRef}
                  size={Size.Sm}
                  value={isEditing ? draftName : view.label}
                  readOnly={!isEditing}
                  onChange={(value) => setDraftName(value)}
                  onPointerDown={(event) => {
                    if (isEditing) {
                      event.stopPropagation();
                    }
                  }}
                  onClick={(event) => {
                    if (isEditing) {
                      event.stopPropagation();
                    }
                  }}
                  onBlur={() => {
                    if (isEditing) {
                      finishEditing(true);
                    }
                  }}
                  onKeyDown={(event) => {
                    if (!isEditing) return;
                    event.stopPropagation();
                    if (event.key === "Enter") {
                      event.preventDefault();
                      finishEditing(true);
                    } else if (event.key === "Escape") {
                      event.preventDefault();
                      finishEditing(false);
                    }
                  }}
                  outline="hidden"
                  className={clsx(
                    "bg-transparent border rounded-xs",
                    isEditing
                      ? "border-neutral-500/40 focus:border-neutral-500/70"
                      : "pointer-events-none border-transparent",
                  )}
                  wrapperClassName="flex-1 min-w-0"
                />
                <span className="inline-flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    title="Rename view"
                    aria-label="Rename view"
                    className="size-5 rounded-xs grid place-items-center hover:bg-neutral-500/15"
                    onPointerDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      finishEditing(true);
                      beginEditing(view.id, view.label);
                    }}
                  >
                    <IconEdit className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    title="Copy view"
                    aria-label="Copy view"
                    className="size-5 rounded-xs grid place-items-center hover:bg-neutral-500/15"
                    onPointerDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      finishEditing(true);
                      onCopyView(view.id);
                    }}
                  >
                    <IconCopy className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    title="Delete view"
                    aria-label="Delete view"
                    disabled={viewIds.length <= 1}
                    className="size-5 rounded-xs grid place-items-center hover:bg-neutral-500/15 disabled:opacity-50 disabled:pointer-events-none"
                    onPointerDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      finishEditing(true);
                      onRemoveView(view.id);
                    }}
                  >
                    <IconTrash className="h-3.5 w-3.5" />
                  </button>
                </span>
              </span>
            </div>
          );
        })}

        <NestedSeparator />
        <NestedItem
          left={<IconPlus className="h-3/5 aspect-square" />}
          onClick={() => {
            finishEditing(true);
            onCreateView();
          }}
        >
          Create New View
        </NestedItem>
      </Dropdown>
    </div>
  );
});
