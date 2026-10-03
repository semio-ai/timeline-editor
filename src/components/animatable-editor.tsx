import { memo, useCallback, useMemo, useRef, useState } from "react";
import { clsx } from "clsx";
import { SliderNumberField, Size, TextField, ToggleSquare } from "@semio/ui";
import {
  RawValue,
  toDegrees,
  toRadians,
  unitDisplay,
  usePlayerStore,
  useValuesStore,
} from "@semio/utils";
import { useShallow } from "zustand/react/shallow";
import { SourceRowData } from "../types";
import { useAnimationStore, useColors } from "../hooks";
import { AnimationActions, AnimationData } from "../store-types";
import { DEFAULT_COLOR } from "../constants";
import { buildTrackKey } from "../utils/track-key";

export interface AnimatableEditorProps {
  rowId: string;
  data: SourceRowData;
  playing: boolean;
  emphasis?: boolean;
  onEmphasisChange?: (v: boolean) => void;
  handleValueChange: (value: RawValue | ((current: RawValue) => RawValue)) => void;
  active?: boolean;
  colorOverride?: string;
  /** When true, the label is rendered externally (e.g. in a separate grid column). */
  hideLabel?: boolean;
}

function InnerAnimatableEditor({
  rowId,
  data,
  playing,
  emphasis,
  onEmphasisChange,
  handleValueChange,
  active = true,
  colorOverride,
  hideLabel = false,
}: AnimatableEditorProps) {
  const trueColor = useColors(data.trackId ?? data.animatableId);
  const color = colorOverride ?? (active ? trueColor : DEFAULT_COLOR);

  // Stamp is read at drag-start fire time (see worldStamp below) — subscribing
  // here would re-render the editor every player tick during playback, and
  // each editor row sits inside a ControlRow + radix dropdown plumbing,
  // multiplying the cascade.
  const valueKey = useMemo(
    () => buildTrackKey(data.namespaceId, data.instanceId, data.trackId),
    [data.namespaceId, data.instanceId, data.trackId],
  );
  const storedValue = useValuesStore(
    useCallback((state) => state.values.get(valueKey), [valueKey]),
  );

  // Drag pipeline integration (value-driven)
  const { startValueDrag, updateValueDrag, commitValueDrag, cancelValueDrag } = useAnimationStore(
    useShallow((state: AnimationActions & AnimationData) => ({
      startValueDrag: state.startValueDrag,
      updateValueDrag: state.updateValueDrag,
      commitValueDrag: state.commitValueDrag,
      cancelValueDrag: state.cancelValueDrag,
    })),
  );

  const dragActiveRef = useRef(false);
  const dragDidMoveRef = useRef(false);
  // Playhead world stamp anchoring an in-progress text edit. Typing/wheeling a
  // value writes a key at the current playhead; the anchor is captured on the
  // first commit of an edit session and reset on blur. If the user scrubs the
  // playhead off the anchor mid-edit, further text commits (including the
  // commit-on-blur) are skipped — otherwise the value entered for the original
  // position would be written as a key at the new playhead position.
  const editStampRef = useRef<number | null>(null);
  const [displayValue, setDisplayValue] = useState<number | null>(null);

  const { animatableValue, track } = useAnimationStore(
    useShallow((state: AnimationData) => ({
      animatableValue: state.animatables[data.animatableId],
      track: state.tracks[data.trackId],
    })),
  );

  const scalarStoredValue = useMemo(() => {
    if (typeof storedValue === "number") return storedValue;
    if (typeof storedValue === "string") return storedValue;
    if (typeof storedValue === "boolean") return storedValue;
    return undefined;
  }, [storedValue]);

  const hasAnimatable = Boolean(animatableValue && track);

  const rawValue = useMemo(() => {
    if (!animatableValue) return undefined;
    return scalarStoredValue ?? animatableValue.default;
  }, [animatableValue, scalarStoredValue]);

  // Display only: the field shows degrees and percentages, and every value it
  // hands back — typed, committed or dragged — is converted to the stored unit.
  const display = unitDisplay(animatableValue?.pub?.units);
  const angular = data.iconCode === "rad" || display.code === "rad";
  const renderTransformer = angular ? toDegrees : display.toDisplay;
  const renderInverse = angular ? toRadians : display.fromDisplay;

  const limits = useMemo(() => {
    if (animatableValue?.type !== "number") {
      return { min: undefined, max: undefined };
    }
    return {
      min: animatableValue.constraints?.min ?? undefined,
      max: animatableValue.constraints?.max ?? undefined,
    };
  }, [animatableValue]);
  const hasFiniteBounds =
    limits.min !== undefined &&
    limits.max !== undefined &&
    limits.min !== -Infinity &&
    limits.max !== Infinity;
  const relativeDragRange = hasFiniteBounds ? undefined : angular ? 360 : display.relativeDragRange;
  const valueScaleOverride = useMemo(() => {
    if (!angular || hasFiniteBounds) return undefined;
    return {
      domain: [-Math.PI, Math.PI] as [number, number],
      clamp: false,
    };
  }, [angular, hasFiniteBounds]);

  const updateTrack = useAnimationStore(useShallow((state: AnimationActions) => state.updateTrack));

  const onChange = useCallback(
    (newValue: RawValue | ((change: RawValue) => RawValue)) => {
      handleValueChange(newValue);
    },
    [handleValueChange],
  );

  const label = useMemo(() => {
    if (track?.name) {
      return track.name;
    }
    return animatableValue?.name ?? "";
  }, [track?.name, animatableValue?.name]);

  if (!hasAnimatable || rawValue === undefined) {
    return <div className={clsx("h-7 animate-pulse rounded bg-neutral-700/30", !hideLabel && "flex-1")} />;
  }

  if (data.type === "number" && typeof rawValue === "number") {
    return (
      <SliderNumberField
        onDragStartNative={(e, currentValue) => {
          if (playing || !data.editable || !active) return;

          dragActiveRef.current = true;
          dragDidMoveRef.current = false;
          setDisplayValue(currentValue as number);

          startValueDrag({
            rowId,
            trackId: data.trackId,
            namespaceId: data.namespaceId,
            instanceId: data.instanceId,
            worldStamp: usePlayerStore.getState().player.stamp,
            valueScale: valueScaleOverride,
          });
        }}
        onDragMoveNative={(e, currentValue) => {
          if (!dragActiveRef.current) return;
          setDisplayValue(currentValue as number);
          dragDidMoveRef.current = true;

          const currentActual = renderInverse(currentValue as number);

          updateValueDrag({
            currentValue: currentActual,
            modifiers: {
              alt: (e as MouseEvent).altKey ?? false,
              shift: (e as MouseEvent).shiftKey ?? false,
              meta: (e as MouseEvent).metaKey ?? false,
            },
          });
        }}
        onDragEndNative={(_e, _currentValue) => {
          if (!dragActiveRef.current) return;
          dragActiveRef.current = false;
          setDisplayValue(null);
          if (dragDidMoveRef.current) {
            commitValueDrag();
          } else {
            cancelValueDrag();
          }
          dragDidMoveRef.current = false;
        }}
        size={Size.Sm}
        strictText={false}
        strictSlider={hasFiniteBounds}
        disabled={playing || !data.editable || !active}
        value={displayValue !== null ? displayValue : renderTransformer(rawValue)}
        min={limits.min !== undefined ? renderTransformer(limits.min) : undefined}
        max={limits.max !== undefined ? renderTransformer(limits.max) : undefined}
        relativeDragRange={relativeDragRange}
        color={color}
        onChange={(v) => {
          if (dragActiveRef.current) return;
          const stamp = usePlayerStore.getState().player.stamp;
          if (editStampRef.current === null) {
            // First commit of this edit session anchors here.
            editStampRef.current = stamp;
          } else if (stamp !== editStampRef.current) {
            // Playhead scrubbed off the anchor since editing began — abandon
            // the commit so we don't write the in-progress value at the new
            // position.
            return;
          }
          onChange(renderInverse(v));
        }}
        onFocus={() => {
          editStampRef.current = null;
        }}
        onBlur={() => {
          editStampRef.current = null;
        }}
        label={hideLabel ? undefined : label}
        onLabelChange={hideLabel ? undefined : (track ? (v) => updateTrack({ id: track.id, name: v }) : undefined)}
        highlight={emphasis}
        units={angular ? "°" : display.label}
        onHighlightChange={onEmphasisChange}
        wrapperClassName={hideLabel ? undefined : "flex-1"}
        className={hideLabel ? undefined : "flex-1"}
      />
    );
  } else if (data.type === "string" && typeof rawValue === "string") {
    return (
      <TextField
        value={rawValue}
        readOnly={playing || !data.editable || !active}
        size={Size.Sm}
        onChange={(v) => onChange(v)}
      />
    );
  } else if (data.type === "boolean" && typeof rawValue === "boolean") {
    return (
      <ToggleSquare
        value={rawValue}
        disabled={playing || !data.editable || !active}
        size={Size.Sm}
        onChange={(v) => onChange(v)}
      />
    );
  }
}

export const AnimatableEditor = memo(InnerAnimatableEditor);
