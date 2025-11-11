import { memo, useCallback, useMemo } from "react";
import {
  Button,
  StaticIcon,
  Variant,
  Size,
  Dropdown,
  NestedLabel,
  NestedColorPicker,
  TextField,
} from "@semio/ui";
import { uniq } from "lodash";
import { clsx } from "clsx";
import { usePlayerStore, PlayerData, RawValue } from "@semio/utils";
import { IconDotsVertical, IconChevronDown } from "@tabler/icons-react";
import { useShallow } from "zustand/react/shallow";
import { type SourceRow } from "../types";
import {
  useAnimationStore,
  useColors,
  useLocalGlobalTransformLookup,
  useNames,
  useTrackAnimatableLookup,
} from "../hooks";
import { DEFAULT_COLOR, GROUP_TYPES } from "../constants";
import { AnimationActions, AnimationData } from "../store-types";
import { TrackControl } from "./track-control";
import { AnimatableEditor } from "./animatable-editor";
import { DataIcon } from "./data-icon";

export interface ControlWidgetProps {
  sourceRow: SourceRow;
  emphasis?: boolean;
  onEmphasisChange?: (emphasis: boolean) => void;
}

function InnerControlWidget({ sourceRow, emphasis, onEmphasisChange }: ControlWidgetProps) {
  // Select computed row data using snapshot-backed slice (stable identity)
  const computedRowData = useAnimationStore(
    useShallow((state: AnimationData) => state.derivedSnapshot?.rows?.[sourceRow.id]?.computed),
  );

  const trackIds = uniq(sourceRow.data.map((d) => d.trackId));
  const allReadonly = sourceRow.data.every((d) => !d.editable);

  const playing = usePlayerStore(useShallow((state: PlayerData) => state.player.running));

  const updateControlColor = useAnimationStore(
    useShallow((state: AnimationActions) => state.updateControlColor),
  );

  // Resolve current interpolators from snapshot-maintained slice
  const snapshot = useAnimationStore(useShallow((state: AnimationData) => state.derivedSnapshot));
  const animatables = useAnimationStore(useShallow((state) => state.animatables));

  const trackAnimatableLookup = useTrackAnimatableLookup();
  const localGlobalTransformLookup = useLocalGlobalTransformLookup();

  // Compute unique instance for this row (must be exactly one)
  const uniqueInstanceId = useMemo(() => {
    const ids = uniq(
      sourceRow.data.map((d) => d.instanceId).filter((v): v is string => Boolean(v)),
    );
    return ids.length === 1 ? ids[0] : undefined;
  }, [sourceRow.data]);

  // Derive instanced frame directly from snapshot + current stamp; avoid local state to prevent staleness
  const playerStamp = usePlayerStore(useShallow((state: PlayerData) => state.player.stamp));
  const currentLocalStamp = useMemo(() => {
    if (!uniqueInstanceId) return playerStamp;
    const toLocal = localGlobalTransformLookup.toLocal[uniqueInstanceId];
    return typeof toLocal === "function" ? toLocal(playerStamp) : playerStamp;
  }, [playerStamp, uniqueInstanceId, localGlobalTransformLookup]);
  const instancedFrame = useMemo(
    () => computedRowData?.virtualFrames?.find((s) => s.stamp === currentLocalStamp),
    [computedRowData, currentLocalStamp],
  );

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
    updateTrack,
    updateSource,
    insertKeypointAtWorldStamp,
  } = useAnimationStore(
    useShallow((state: AnimationActions & AnimationData) => ({
      updateKeypoints: state.updateKeypoints,
      removeKeypoints: state.removeKeypoints,
      updateTrack: state.updateTrack,
      updateSource: state.updateSource,
      insertKeypointAtWorldStamp: state.insertKeypointAtWorldStamp,
    })),
  );

  const updateExpanded = useCallback(
    (expanded: boolean) => {
      updateSource(sourceRow.id, expanded);
    },
    [updateSource, sourceRow.id],
  );

  const trueColor = useColors(trackIds);
  const color = isActive ? trueColor : DEFAULT_COLOR;
  const name = useNames(trackIds);

  const isGroup = sourceRow.data.length !== 1 || GROUP_TYPES.has(sourceRow.data[0].type);
  const iconCode = isGroup ? "group" : sourceRow.data[0].iconCode || "Group";

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
      <div
        className={clsx(
          "w-full grid grid-cols-[64px_16px_1fr_16px] pl-1 pr-2 gap-2 h-9 items-center",
          !isActive && uniqueInstanceId && "pointer-events-none select-none",
        )}
      >
        <TrackControl
          disabled={allReadonly || !isActive}
          source={sourceRow}
          filled={instancedFrame !== undefined}
          color={color}
          onHexClick={() => {
            if (instancedFrame !== undefined) {
              const removals = instancedFrame.points.map((p) => ({
                trackId: p.trackId,
                keypointId: p.id,
              }));
              removeKeypoints(removals);
            } else {
              // Insert a keypoint at the current world stamp for each datum using instanceId
              // (value is resolved via derived snapshot interpolator inside the action).
              sourceRow.data.forEach((datum) => {
                insertKeypointAtWorldStamp(datum.trackId, playerStamp, datum.instanceId);
              });
            }
          }}
        />
        {isGroup ? (
          <Button
            size="fit"
            visuals="inverted"
            color={color}
            onClick={() => {
              updateExpanded(!sourceRow.expanded);
            }}
            leftIcon={
              <IconChevronDown
                className={clsx(
                  "transition-transform",
                  sourceRow.expanded ? "-rotate-180 size-3" : "rotate-0 size-3",
                )}
              />
            }
          />
        ) : (
          <StaticIcon size="fit" className="size-3" color={color}>
            <DataIcon iconCode={iconCode} size="13px" />
          </StaticIcon>
        )}
        {isGroup ? (
          <TextField
            size={Size.Sm}
            color={color}
            value={name}
            onChange={(val) => {
              trackIds.forEach((id) => {
                updateTrack({ id, name: val });
              });
            }}
          />
        ) : (
          <div className="flex-1 flex min-w-0">
            <AnimatableEditor
              rowId={sourceRow.id}
              data={sourceRow.data[0]}
              active={isActive}
              playing={playing}
              emphasis={emphasis}
              onEmphasisChange={onEmphasisChange}
              handleValueChange={(change) => {
                const datumAnimatablePairs = sourceRow.data.map((datum) => ({
                  datum,
                  animatableId: trackAnimatableLookup[datum.trackId].id,
                }));
                const updates = datumAnimatablePairs
                  .map(({ datum, animatableId }) => {
                    const trackKey = `${datum.namespaceId}/${datum.instanceId}/${datum.trackId}`;
                    const interp = snapshot?.tracks[trackKey as any]?.canonical.interpolator;
                    const toLocal = localGlobalTransformLookup.toLocal[datum.instanceId];
                    const localStamp =
                      typeof toLocal === "function" ? toLocal(playerStamp) : playerStamp;
                    const value: RawValue | undefined = interp ? interp(localStamp) : undefined;
                    const defaultValue = animatables[animatableId].default;
                    if (typeof change === "function") {
                      const newValue = change(value ?? defaultValue);
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
                          change,
                          stamp: localStamp,
                        },
                      };
                    }
                  })
                  .filter((u) => u.keypoint.value !== undefined);
                updateKeypoints(updates, true);
              }}
            />
          </div>
        )}
        <div className="w-3 flex items-center justify-around mr-1">
          <Dropdown
            variant={Variant.Info}
            trigger={
              <span>
                <Button
                  size={Size.Xs}
                  className="flex items-center justify-center"
                  visuals="inverted"
                  leftIcon={<IconDotsVertical className="size-3/5" />}
                />
              </span>
            }
          >
            <NestedLabel>Control Settings</NestedLabel>
            <NestedColorPicker
              variant={Variant.Info}
              disabled={trackIds.length > 1}
              value={color}
              onChange={(v) => {
                if (trackIds[0]) updateControlColor(trackIds[0], v);
              }}
            />
          </Dropdown>
        </div>
      </div>
    </div>
  );
}

export const ControlWidget = memo(InnerControlWidget);
