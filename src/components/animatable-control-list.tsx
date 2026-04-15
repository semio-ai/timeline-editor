import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { AnimatePresence, motion } from "motion/react";
import { clsx } from "clsx";
import type { AnimatableValue } from "@semio/utils";
import { useAnimationStore } from "../hooks";
import {
  AnimatableControl,
  type AnimatableControlMode,
  type AnimatableGroupControlProps,
  type AnimatableLeafControlProps,
} from "./animatable-control";

export interface AnimatableControlListProps {
  animatableIds?: string[];
  animatables?: AnimatableValue[];
  className?: string;
  listClassName?: string;
  itemClassName?: string;
  defaultExpanded?: boolean;
  expandedGroups?: Record<string, boolean>;
  onExpandedGroupsChange?: (next: Record<string, boolean>) => void;
  onGroupToggle?: (groupId: string, expanded: boolean) => void;
  getLeafProps?: (context: LeafContext) => Partial<AnimatableLeafControlProps>;
  getGroupProps?: (context: GroupContext) => Partial<AnimatableGroupControlProps>;
  getGroupLabel?: (groupId: string, animatable: AnimatableValue) => string;
  sortGroups?: (left: GroupBucket, right: GroupBucket) => number;
  sortGroupChildren?: (left: AnimatableValue, right: AnimatableValue) => number;
  sortUngrouped?: (left: AnimatableValue, right: AnimatableValue) => number;
}

type ControlRowData =
  | {
      kind: "group";
      groupId: string;
      label: string;
      childAnimatableIds: string[];
      sourceRowId?: string;
      expanded: boolean;
      addable: boolean;
      depth: number;
    }
  | {
      kind: "animatable";
      animatableId: string;
      sourceRowId?: string;
      depth: number;
    };

interface GroupBucket {
  id: string;
  label: string;
  items: AnimatableValue[];
}

interface LeafContext {
  animatableId: string;
  sourceRowId?: string;
  mode: AnimatableControlMode;
}

interface GroupContext {
  groupId: string;
  label: string;
  childAnimatableIds: string[];
  sourceRowId?: string;
  expanded: boolean;
  addable: boolean;
}

export function AnimatableControlList({
  animatableIds,
  animatables,
  className,
  listClassName,
  itemClassName,
  defaultExpanded = true,
  expandedGroups,
  onExpandedGroupsChange,
  onGroupToggle,
  getLeafProps,
  getGroupProps,
  getGroupLabel,
  sortGroups,
  sortGroupChildren,
  sortUngrouped,
}: AnimatableControlListProps): ReactNode {
  const rows = useAnimationStore(useShallow((state) => Object.values(state.instancedTrackSources)));
  const selectionInstanceId = useAnimationStore(
    useShallow((state) => state.selectionState.instanceId),
  );
  const storeAnimatables = useAnimationStore(useShallow((state) => state.animatables));

  const [localExpandedGroups, setLocalExpandedGroups] = useState<Record<string, boolean>>({});
  const expandedLookup = expandedGroups ?? localExpandedGroups;

  const resolvedAnimatables = useMemo(() => {
    if (animatables && animatables.length > 0) {
      return animatables;
    }
    if (animatableIds && animatableIds.length > 0) {
      return animatableIds
        .map((id) => storeAnimatables[id])
        .filter((value): value is AnimatableValue => Boolean(value));
    }
    return Object.values(storeAnimatables);
  }, [animatableIds, animatables, storeAnimatables]);

  const rowsForInstance = useMemo(() => {
    if (selectionInstanceId) {
      return rows.filter((row) =>
        row.data.every((datum) => datum.instanceId === selectionInstanceId),
      );
    }

    const foregroundRows = rows.filter((row) =>
      row.data.some(
        (datum) =>
          datum.layerBand === "foreground-selected" || datum.layerBand === "foreground-unselected",
      ),
    );

    return foregroundRows.length > 0 ? foregroundRows : rows;
  }, [rows, selectionInstanceId]);

  const rowByAnimatableId = useMemo(() => {
    const lookup = new Map<string, string>();
    rowsForInstance.forEach((row) => {
      if (row.data.length !== 1) return;
      const animatableId = row.data[0]?.animatableId;
      if (animatableId) {
        lookup.set(animatableId, row.id);
      }
    });
    return lookup;
  }, [rowsForInstance]);

  const groupRowIdByChildKey = useMemo(() => {
    const lookup = new Map<string, string>();
    rowsForInstance.forEach((row) => {
      if (row.data.length <= 1) return;
      const key = row.data
        .map((datum) => datum.animatableId)
        .filter(Boolean)
        .sort()
        .join("|");
      if (key) {
        lookup.set(key, row.id);
      }
    });
    return lookup;
  }, [rowsForInstance]);

  const groupRowIdByGroupId = useMemo(() => {
    const lookup = new Map<string, string>();
    rowsForInstance.forEach((row) => {
      if (row.data.length <= 1) return;
      const groupId = row.id.split("/").pop();
      if (groupId) {
        lookup.set(groupId, row.id);
      }
    });
    return lookup;
  }, [rowsForInstance]);

  const { groups, ungrouped } = useMemo(() => {
    const groupLookup = new Map<string, GroupBucket>();
    const ungroupedAnimatables: AnimatableValue[] = [];

    resolvedAnimatables.forEach((animatable) => {
      const groupId = animatable.group?.id;
      if (!groupId) {
        ungroupedAnimatables.push(animatable);
        return;
      }
      const existing = groupLookup.get(groupId as string);
      if (existing) {
        existing.items.push(animatable);
        return;
      }
      groupLookup.set(groupId as string, {
        id: groupId,
        label: resolveGroupLabel(animatable, groupId as string, getGroupLabel),
        items: [animatable],
      });
    });

    const grouped = Array.from(groupLookup.values()).map((group) => ({
      ...group,
      items: group.items.slice().sort(sortGroupChildren ?? defaultSortGroupChildren),
    }));

    grouped.sort(sortGroups ?? defaultSortGroups);
    ungroupedAnimatables.sort(sortUngrouped ?? defaultSortByName);

    return { groups: grouped, ungrouped: ungroupedAnimatables };
  }, [getGroupLabel, resolvedAnimatables, sortGroupChildren, sortGroups, sortUngrouped]);

  const controlRows: ControlRowData[] = useMemo(() => {
    const result: ControlRowData[] = [];

    groups.forEach((group) => {
      const childIds = group.items.map((item) => item.id);
      const groupKey = childIds.slice().sort().join("|");
      const sourceRowId =
        groupRowIdByChildKey.get(groupKey) ??
        groupRowIdByGroupId.get(group.id) ??
        resolveGroupRowId(group.id, childIds, rowByAnimatableId);
      const expanded = expandedLookup[group.id] ?? defaultExpanded;
      const addable = childIds.some((id) => !rowByAnimatableId.has(id));
      result.push({
        kind: "group",
        groupId: group.id,
        label: group.label,
        childAnimatableIds: childIds,
        sourceRowId,
        expanded,
        addable,
        depth: 0,
      });

      if (expanded) {
        childIds.forEach((animatableId) => {
          const innerSourceRowId = rowByAnimatableId.get(animatableId);
          result.push({
            kind: "animatable",
            animatableId,
            sourceRowId: innerSourceRowId,
            depth: 1,
          });
        });
      }
    });

    ungrouped.forEach((animatable) => {
      const sourceRowId = rowByAnimatableId.get(animatable.id);
      result.push({
        kind: "animatable",
        animatableId: animatable.id,
        sourceRowId,
        depth: 0,
      });
    });
    return result;
  }, [
    defaultExpanded,
    expandedLookup,
    groupRowIdByChildKey,
    groupRowIdByGroupId,
    groups,
    rowByAnimatableId,
    ungrouped,
  ]);

  const handleToggle = (groupId: string, expanded: boolean) => {
    const next = { ...expandedLookup, [groupId]: expanded };
    if (expandedGroups && onExpandedGroupsChange) {
      onExpandedGroupsChange(next);
    } else {
      setLocalExpandedGroups(next);
      onExpandedGroupsChange?.(next);
    }
    onGroupToggle?.(groupId, expanded);
  };

  const hasRows = controlRows.length > 0;

  return (
    <div className={clsx("flex h-full w-full flex-col", className)}>
      <div className={clsx("flex flex-col gap-0", listClassName)}>
        {hasRows && (
          <AnimatePresence>
            {controlRows.map((row) => {
              if (row.kind === "group") {
                const groupOverrides = getGroupProps?.({
                  groupId: row.groupId,
                  label: row.label,
                  childAnimatableIds: row.childAnimatableIds,
                  sourceRowId: row.sourceRowId,
                  expanded: row.expanded,
                  addable: row.addable,
                });
                const {
                  sourceRowId: overrideSourceRowId,
                  label: overrideLabel,
                  expanded: overrideExpanded,
                  addable: overrideAddable,
                  onToggle: overrideOnToggle,
                  ...groupProps
                } = groupOverrides ?? {};
                const resolvedSourceRowId = overrideSourceRowId ?? row.sourceRowId;
                const resolvedLabel = overrideLabel ?? row.label;
                const resolvedExpanded = overrideExpanded ?? row.expanded;
                const resolvedAddable = overrideAddable ?? row.addable;

                return (
                  <motion.div
                    key={`group-${row.groupId}`}
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{
                      opacity: 0,
                      y: -20,
                      transition: { duration: 0.15, ease: "easeInOut" },
                    }}
                    className={itemClassName}
                  >
                    <AnimatableControl
                      kind="group"
                      groupId={row.groupId}
                      label={resolvedLabel}
                      childAnimatableIds={row.childAnimatableIds}
                      sourceRowId={resolvedSourceRowId}
                      expanded={resolvedExpanded}
                      addable={resolvedAddable}
                      depth={row.depth}
                      onToggle={(next) => {
                        handleToggle(row.groupId, next);
                        overrideOnToggle?.(next);
                      }}
                      {...groupProps}
                    />
                  </motion.div>
                );
              }

              const leafMode: AnimatableControlMode = row.sourceRowId ? "track" : "track-missing";
              const leafOverrides = getLeafProps?.({
                animatableId: row.animatableId,
                sourceRowId: row.sourceRowId,
                mode: leafMode,
              });
              const {
                sourceRowId: overrideSourceRowId,
                mode: overrideMode,
                ...leafProps
              } = leafOverrides ?? {};
              const resolvedSourceRowId = overrideSourceRowId ?? row.sourceRowId;
              const resolvedMode =
                overrideMode ?? (resolvedSourceRowId ? "track" : "track-missing");

              return (
                <motion.div
                  key={row.animatableId}
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20, transition: { duration: 0.15, ease: "easeInOut" } }}
                  className={itemClassName}
                >
                  <AnimatableControl
                    animatableId={row.animatableId}
                    sourceRowId={resolvedSourceRowId}
                    mode={resolvedMode}
                    depth={row.depth}
                    {...leafProps}
                  />
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

function defaultSortByName(left: AnimatableValue, right: AnimatableValue): number {
  const leftLabel = left.name ?? left.id;
  const rightLabel = right.name ?? right.id;
  return leftLabel.localeCompare(rightLabel);
}

function defaultSortGroupChildren(left: AnimatableValue, right: AnimatableValue): number {
  const leftOrder = left.group?.order ?? Number.POSITIVE_INFINITY;
  const rightOrder = right.group?.order ?? Number.POSITIVE_INFINITY;
  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }
  return defaultSortByName(left, right);
}

function defaultSortGroups(left: GroupBucket, right: GroupBucket): number {
  return left.label.localeCompare(right.label);
}

function resolveGroupLabel(
  animatable: AnimatableValue,
  groupId: string,
  getGroupLabel?: (groupId: string, animatable: AnimatableValue) => string,
): string {
  if (getGroupLabel) {
    return getGroupLabel(groupId, animatable);
  }
  const axis = animatable.group?.axis;
  if (axis && animatable.name) {
    const suffix = ` ${(axis as string).toUpperCase()}`;
    if (animatable.name.endsWith(suffix)) {
      return animatable.name.slice(0, -suffix.length);
    }
  }
  return animatable.name ?? groupId;
}

function resolveGroupRowId(
  groupId: string,
  childIds: string[],
  rowByAnimatableId: Map<string, string>,
): string | undefined {
  const anchorChildId = childIds.find((id) => rowByAnimatableId.has(id));
  if (!anchorChildId) return undefined;
  const anchorRowId = rowByAnimatableId.get(anchorChildId);
  if (!anchorRowId) return undefined;
  const [namespaceId, instanceId] = anchorRowId.split("/");
  if (!namespaceId || !instanceId) return undefined;
  return `${namespaceId}/${instanceId}/${groupId}`;
}
