import { memo, useCallback, useMemo } from "react";
import {
  Button,
  StaticIcon,
  Variant,
  Size,
  Dropdown,
  NestedLabel,
  NestedColorPicker,
  NestedItem,
  TextField,
  Tooltip,
  ICON_CLASS_NAME,
} from "@semio/ui";
import { uniq } from "lodash";
import { clsx } from "clsx";
import { usePlayerStore, PlayerData } from "@semio/utils";
import { IconDotsVertical, IconMicrophone, IconMicrophoneOff } from "@tabler/icons-react";
import { useShallow } from "zustand/react/shallow";
import { type SourceRow } from "../types";
import {
  useAnimationStore,
  useColors,
  useKeyControlState,
  useLocalGlobalTransformLookup,
  useNames,
} from "../hooks";
import { useValuesRef } from "../hooks/use-values-ref";
import { DEFAULT_COLOR, GROUP_TYPES } from "../constants";
import { AnimationActions, AnimationData } from "../store-types";
import type { SimpleRawValue } from "../types/data/simple-track";
import { buildTrackKey } from "../utils/track-key";
import { getSemanticLabelForIconCode } from "../functions";
import { KeyStrip } from "./key-strip";
import { AnimatableEditor } from "./animatable-editor";
import { DataIcon } from "./data-icon";
import { ControlRow, GroupToggle, TrackPropertiesStrip } from "./controls";
import { TreeIconColumn } from "./controls/tree-connector";

export interface TrackControlProps {
  sourceRow: SourceRow;
  ancestorIsLast?: boolean[];
  /** Override the depth from sourceRow (used when rendered inside AnimatableControlList). */
  depthOverride?: number;
  /** Override the control strip mode (e.g., force "keySkip" in the animatable control list). */
  controlStripOverride?: "keySkip" | "properties";
  emphasis?: boolean;
  onEmphasisChange?: (emphasis: boolean) => void;
}

function InnerTrackControl({
  sourceRow,
  depthOverride,
  controlStripOverride,
  emphasis,
  onEmphasisChange,
}: TrackControlProps) {
  const trackIds = uniq(sourceRow.data.map((d) => d.trackId));
  const allReadonly = sourceRow.data.every((d) => !d.editable);

  // Read visible/locked from source row data (derived from globalSourceTree).
  // For groups, data entries are copies of children — compute aggregate state.
  const allVisible = sourceRow.data.every((d) => d.visible !== false);
  const noneVisible = sourceRow.data.every((d) => d.visible === false);
  const rowVisible: boolean | "partial" = allVisible ? true : noneVisible ? false : "partial";

  const allLocked = sourceRow.data.every((d) => d.locked === true);
  const noneLocked = sourceRow.data.every((d) => d.locked !== true);
  const rowLocked: boolean | "partial" = allLocked ? true : noneLocked ? false : "partial";

  const playing = usePlayerStore(useShallow((state: PlayerData) => state.player.running));
  const storeControlStripMode = useAnimationStore(
    useShallow((state: AnimationData) => state.preferences.controlStripMode),
  );
  const controlStripMode = controlStripOverride ?? storeControlStripMode;

  const updateControlColor = useAnimationStore(
    useShallow((state: AnimationActions) => state.updateControlColor),
  );
  const setTracksMuted = useAnimationStore(
    useShallow((state: AnimationActions) => state.setTracksMuted),
  );
  const setTracksVisible = useAnimationStore(
    useShallow((state: AnimationActions) => state.setTracksVisible),
  );
  const setTracksLocked = useAnimationStore(
    useShallow((state: AnimationActions) => state.setTracksLocked),
  );

  const animatables = useAnimationStore(useShallow((state) => state.animatables));
  const valuesRef = useValuesRef();
  const trackMuted = useMemo(() => {
    if (trackIds.length !== 1) return false;
    const [entry] = sourceRow.data;
    return entry?.muted ?? false;
  }, [sourceRow.data, trackIds.length]);
  const rowMuted: boolean | "partial" = useMemo(() => {
    if (sourceRow.data.length === 0) return false;
    const allMuted = sourceRow.data.every((entry) => entry.muted ?? false);
    const noneMuted = sourceRow.data.every((entry) => !(entry.muted ?? false));
    return allMuted ? true : noneMuted ? false : "partial";
  }, [sourceRow.data]);

  const localGlobalTransformLookup = useLocalGlobalTransformLookup();

  // Compute unique instance for this row (must be exactly one)
  const uniqueInstanceId = useMemo(() => {
    const ids = uniq(
      sourceRow.data.map((d) => d.instanceId).filter((v): v is string => Boolean(v)),
    );
    return ids.length === 1 ? ids[0] : undefined;
  }, [sourceRow.data]);

  const playerStamp = usePlayerStore(useShallow((state: PlayerData) => state.player.stamp));
  const { keyState, currentFrame, missingEntries, targetPoints } = useKeyControlState(sourceRow);

  const selectionInstanceId = useAnimationStore(
    useShallow((state: AnimationData) => state.selectionState.instanceId),
  );
  const focusSelectionInstance = useAnimationStore(
    useShallow((state: AnimationActions) => state.focusSelectionInstance),
  );

  // Row is active if it has no unique instance mapping OR it matches the selected instance
  const isActive = useMemo(
    () => !uniqueInstanceId || selectionInstanceId === uniqueInstanceId,
    [uniqueInstanceId, selectionInstanceId],
  );

  const handleActivate = useCallback(
    (e?: { stopPropagation?: () => void; preventDefault?: () => void }) => {
      e?.stopPropagation?.();
      e?.preventDefault?.();
      if (uniqueInstanceId) {
        focusSelectionInstance(uniqueInstanceId);
      }
    },
    [focusSelectionInstance, uniqueInstanceId],
  );

  // instancedFrame is derived from snapshot and currentLocalStamp; no subscription needed

  const {
    updateKeypoints,
    removeKeypoints,
    updateSource,
    updateTrackGroupName,
    insertKeypointAtWorldStamp,
  } = useAnimationStore(
    useShallow((state: AnimationActions & AnimationData) => ({
      updateKeypoints: state.updateKeypoints,
      removeKeypoints: state.removeKeypoints,
      updateSource: state.updateSource,
      updateTrackGroupName: state.updateTrackGroupName,
      insertKeypointAtWorldStamp: state.insertKeypointAtWorldStamp,
    })),
  );

  const updateExpanded = useCallback(
    (expanded: boolean) => {
      updateSource(sourceRow.id, expanded);
    },
    [updateSource, sourceRow.id],
  );

  const isGroup = sourceRow.data.length !== 1 || GROUP_TYPES.has(sourceRow.data[0].type);

  const trueColor = useColors(trackIds);
  const color = isActive && !rowMuted ? trueColor : DEFAULT_COLOR;
  const resolvedName = useNames(trackIds);
  const groupName = sourceRow.name ?? resolvedName;
  const name = isGroup ? groupName : resolvedName;

  const iconCode = isGroup ? "group" : (sourceRow.data[0].iconCode ?? "none");

  return (
    <div className="relative w-full">
      {/* Interaction guard overlay when inactive; click or Enter/Space activates the row */}
      {!isActive && uniqueInstanceId && (
        <div
          role="button"
          tabIndex={0}
          className="absolute inset-0 z-10 cursor-pointer"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={handleActivate}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              handleActivate(e);
            }
          }}
          aria-label={`Activate ${sourceRow.id}`}
        />
      )}
      <ControlRow
        className={clsx(
          !isActive && uniqueInstanceId && "pointer-events-none select-none",
          rowMuted && isActive && "opacity-60",
          controlStripMode === "keySkip" ? "pr-0.5" : "pr-0.5",
        )}
        isGroup={isGroup}
        treeIcon={
          <TreeIconColumn
            depth={depthOverride ?? sourceRow.depth ?? 0}
            icon={
              isGroup ? (
                <Tooltip content={sourceRow.expanded ? "Collapse Group" : "Expand Group"} invert>
                  <GroupToggle
                    expanded={sourceRow.expanded}
                    onToggle={updateExpanded}
                    disabled={!isActive}
                    color={color}
                  />
                </Tooltip>
              ) : (
                <Tooltip content={getSemanticLabelForIconCode(iconCode)} invert>
                  <div>
                    <StaticIcon size={Size.Md} color={color}>
                      <DataIcon iconCode={iconCode} className={ICON_CLASS_NAME} />
                    </StaticIcon>
                  </div>
                </Tooltip>
              )
            }
          />
        }
        label={
          isGroup ? (
            <TextField
              size={Size.Sm}
              color={color}
              value={name}
              readOnly={playing}
              onChange={(val) => {
                if (playing) return;
                if (!val) return;
                updateSource(sourceRow.id, sourceRow.expanded, undefined);
                updateTrackGroupName(trackIds, val);
              }}
            />
          ) : undefined
        }
        editor={
          !isGroup ? (
            <div className="flex min-w-0 flex-1">
              <AnimatableEditor
                rowId={sourceRow.id}
                data={sourceRow.data[0]}
                active={isActive}
                colorOverride={color}
                playing={playing}
                emphasis={emphasis}
                onEmphasisChange={onEmphasisChange}
                handleValueChange={(change) => {
                  const datumAnimatablePairs = sourceRow.data.map((datum) => ({
                    datum,
                    animatableId: datum.animatableId,
                  }));
                  const updates = datumAnimatablePairs
                    .map(({ datum, animatableId }) => {
                      const toLocal = localGlobalTransformLookup.toLocal[datum.instanceId];
                      const localStamp =
                        typeof toLocal === "function" ? toLocal(playerStamp) : playerStamp;
                      const valueKey = buildTrackKey(
                        datum.namespaceId,
                        datum.instanceId,
                        datum.trackId,
                      );
                      const value = valuesRef.current.get(valueKey) as SimpleRawValue | undefined;
                      const defaultValue = animatables[animatableId]?.default as
                        | SimpleRawValue
                        | undefined;
                      if (typeof change === "function") {
                        const resolvedValue = value ?? defaultValue;
                        if (resolvedValue === undefined) {
                          return null;
                        }
                        const newValue = change(resolvedValue) as SimpleRawValue;
                        if (newValue === undefined) {
                          return null;
                        }
                        return {
                          trackId: datum.trackId,
                          keypoint: {
                            value: newValue,
                            stamp: localStamp,
                          },
                        };
                      } else {
                        return {
                          trackId: datum.trackId,
                          keypoint: {
                            value: change as SimpleRawValue,
                            stamp: localStamp,
                          },
                        };
                      }
                    })
                    .filter(
                      (
                        u,
                      ): u is {
                        trackId: string;
                        keypoint: { value: SimpleRawValue; stamp: number };
                      } => {
                        if (!u) return false;
                        return u.keypoint.value !== undefined;
                      },
                    );
                  updateKeypoints(updates, true);
                }}
              />
            </div>
          ) : undefined
        }
        controls={
          controlStripMode === "properties" ? (
            <TrackPropertiesStrip
              color={color}
              disabled={!isActive || playing}
              visible={rowVisible}
              muted={rowMuted}
              locked={rowLocked}
              onToggleVisible={() => {
                // Use all data entries' track IDs — for groups, entries have type "group"
                // but still carry the original track's namespaceId/instanceId/trackId.
                const ids = uniq(
                  sourceRow.data.map((d) => `${d.namespaceId}/${d.instanceId}/${d.trackId}`),
                );
                if (ids.length > 0) {
                  const next = rowVisible === "partial" ? true : rowVisible === true ? false : true;
                  setTracksVisible(ids, next);
                }
              }}
              onToggleMuted={() => {
                const ids = uniq(
                  sourceRow.data.map((d) => `${d.namespaceId}/${d.instanceId}/${d.trackId}`),
                );
                if (ids.length > 0) {
                  const next = rowMuted === "partial" ? true : !rowMuted;
                  setTracksMuted(ids, next);
                }
              }}
              onToggleLocked={() => {
                const ids = uniq(
                  sourceRow.data.map((d) => `${d.namespaceId}/${d.instanceId}/${d.trackId}`),
                );
                if (ids.length > 0) {
                  const next = rowLocked === "partial" ? true : rowLocked === true ? false : true;
                  setTracksLocked(ids, next);
                }
              }}
            />
          ) : (
            <KeyStrip
              disabled={allReadonly || !isActive || playing}
              source={sourceRow}
              color={color}
              onHexClick={() => {
                if (playing) return;
                if (keyState === "full" && currentFrame) {
                  const points = targetPoints.length > 0 ? targetPoints : currentFrame.points;
                  const removals = points.map((p) => ({
                    trackId: p.trackId,
                    keypointId: p.id,
                  }));
                  removeKeypoints(removals);
                  return;
                }

                const targets = keyState === "partial" ? missingEntries : sourceRow.data;
                targets.forEach((datum) => {
                  insertKeypointAtWorldStamp(datum.trackId, playerStamp, datum.instanceId);
                });
              }}
            />
          )
        }
        options={
          <Dropdown
            disabled={playing}
            variant={Variant.Info}
            trigger={
              <span>
                <Button
                  size={Size.Xs}
                  className="flex items-center justify-center"
                  visuals="inverted"
                  leftIcon={<IconDotsVertical className={ICON_CLASS_NAME} />}
                />
              </span>
            }
          >
            <NestedLabel>Track Settings</NestedLabel>
            <NestedColorPicker
              variant={Variant.Info}
              disabled={trackIds.length > 1 || playing}
              value={color}
              onChange={(v) => {
                if (trackIds[0]) updateControlColor(trackIds[0], v);
              }}
            />
            <NestedItem
              variant={Variant.Info}
              disabled={trackIds.length !== 1 || allReadonly || playing}
              closeOnSelect={false}
              left={
                trackMuted ? (
                  <IconMicrophoneOff className={ICON_CLASS_NAME} />
                ) : (
                  <IconMicrophone className={ICON_CLASS_NAME} />
                )
              }
              onClick={() => {
                if (trackIds.length !== 1 || !trackIds[0]) return;
                setTracksMuted(sourceRow.id, !trackMuted);
              }}
            >
              {trackMuted ? "Muted" : "Not muted"}
            </NestedItem>
          </Dropdown>
        }
      />
    </div>
  );
}

export const TrackControl = memo(InnerTrackControl);
