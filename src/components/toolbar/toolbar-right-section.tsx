import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dropdown,
  ICON_CLASS_NAME,
  NestedItem,
  NestedLabel,
  NestedSeparator,
  Size,
  TextField,
  Tooltip,
  Variant,
} from "@semio/ui";
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

const VIEW_ACTION_BUTTON_CLASS =
  "size-5 rounded-xs grid place-items-center hover:bg-neutral-500/15";

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

  const stopItemActionPropagation = useCallback(
    (event: { preventDefault: () => void; stopPropagation: () => void }) => {
      event.preventDefault();
      event.stopPropagation();
    },
    [],
  );

  const beginEditingFromView = useCallback(
    (viewId: string, label: string) => {
      finishEditing(true);
      beginEditing(viewId, label);
    },
    [beginEditing, finishEditing],
  );

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
            leftIcon={<IconLayout2 className={ICON_CLASS_NAME} />}
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
              onDoubleClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                if (!isEditing) {
                  // Row handles rename intent because read-only TextField disables pointer events.
                  beginEditingFromView(view.id, view.label);
                }
              }}
            >
              <span
                className={clsx(
                  "absolute left-1 top-1/2 -translate-y-1/2 grid place-items-center",
                  "responsive check-indicator",
                  !isActive && "opacity-40",
                )}
              >
                <span className="icon-slot">
                  {isActive ? (
                    <IconPointFilled className={ICON_CLASS_NAME} />
                  ) : (
                    <IconPoint className={ICON_CLASS_NAME} />
                  )}
                </span>
              </span>
              <span className="flex min-w-0 flex-1 items-center gap-1">
                <TextField
                  // Attach the ref only to the active edit field so focus targets the right row.
                  ref={isEditing ? editingInputRef : undefined}
                  size={Size.Sm}
                  value={isEditing ? draftName : view.label}
                  variant={isEditing ? Variant.Info : Variant.Default}
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
                  className={clsx(isEditing ? "bold focus:bold" : "pointer-events-none")}
                  wrapperClassName="flex-1 min-w-0"
                />
                <span className="inline-flex shrink-0 items-center gap-0.5">
                  <Tooltip content="Rename view" side="top">
                    <button
                      type="button"
                      aria-label="Rename view"
                      className={VIEW_ACTION_BUTTON_CLASS}
                      onPointerDown={stopItemActionPropagation}
                      onClick={(event) => {
                        stopItemActionPropagation(event);
                        beginEditingFromView(view.id, view.label);
                      }}
                    >
                      <IconEdit className="h-3.5 w-3.5" />
                    </button>
                  </Tooltip>
                  <Tooltip content="Copy view" side="top">
                    <button
                      type="button"
                      aria-label="Copy view"
                      className={VIEW_ACTION_BUTTON_CLASS}
                      onPointerDown={stopItemActionPropagation}
                      onClick={(event) => {
                        stopItemActionPropagation(event);
                        finishEditing(true);
                        onCopyView(view.id);
                      }}
                    >
                      <IconCopy className="h-3.5 w-3.5" />
                    </button>
                  </Tooltip>
                  <Tooltip content="Delete view" side="top">
                    <button
                      type="button"
                      aria-label="Delete view"
                      disabled={viewIds.length <= 1}
                      className={clsx(
                        VIEW_ACTION_BUTTON_CLASS,
                        "disabled:opacity-50 disabled:pointer-events-none",
                      )}
                      onPointerDown={stopItemActionPropagation}
                      onClick={(event) => {
                        stopItemActionPropagation(event);
                        finishEditing(true);
                        onRemoveView(view.id);
                      }}
                    >
                      <IconTrash className="h-3.5 w-3.5" />
                    </button>
                  </Tooltip>
                </span>
              </span>
            </div>
          );
        })}

        <NestedSeparator />
        <NestedItem
          left={<IconPlus className={ICON_CLASS_NAME} />}
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
