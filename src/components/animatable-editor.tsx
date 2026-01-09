import { memo, useCallback, useMemo, useRef, useState } from "react";
import { SliderNumberField, Size, TextField, ToggleSquare } from "@semio/ui";
import {
  RawValue,
  toDegrees,
  toRadians,
  AnimatableNumber,
  usePlayerStore,
  PlayerData,
} from "@semio/utils";
import { useShallow } from "zustand/react/shallow";
import { InstancedFrameInfo, SourceRowData } from "../types";
import { useAnimationStore, useColors, useLocalGlobalTransformLookup } from "../hooks";
import { AnimationActions, AnimationData } from "../store-types";
import { DEFAULT_COLOR } from "../constants";

export interface AnimatableEditorProps {
  rowId: string;
  data: SourceRowData;
  playing: boolean;
  emphasis?: boolean;
  onEmphasisChange?: (v: boolean) => void;
  handleValueChange: (value: RawValue | ((current: RawValue) => RawValue)) => void;
  active?: boolean;
}

function InnerAnimatableEditor({
  rowId,
  data,
  playing,
  emphasis,
  onEmphasisChange,
  handleValueChange,
  active = true,
}: AnimatableEditorProps) {
  const trueColor = useColors(data.trackId ?? data.animatableId);
  const color = active ? trueColor : DEFAULT_COLOR;

  const snapshot = useAnimationStore(useShallow((state: AnimationData) => state.derivedSnapshot));
  const stamp = usePlayerStore(useShallow((state: PlayerData) => state.player.stamp));
  const trackKey = useMemo(
    () => `${data.namespaceId}/${data.instanceId}/${data.trackId}`,
    [data.namespaceId, data.instanceId, data.trackId],
  );
  const storedValue: RawValue | undefined = useMemo(() => {
    const interp = snapshot?.tracks[trackKey as any]?.canonical.interpolator;
    return interp ? interp(stamp) : undefined;
  }, [trackKey, stamp, snapshot?.tracks]);

  // Drag pipeline integration
  const { startDrag, updateDrag, commitDrag, clickMarker, insertKeypointAtWorldStamp } =
    useAnimationStore(
      useShallow((state: AnimationActions & AnimationData) => ({
        startDrag: state.startDrag,
        updateDrag: state.updateDrag,
        commitDrag: state.commitDrag,
        clickMarker: state.clickMarker,
        insertKeypointAtWorldStamp: state.insertKeypointAtWorldStamp,
      })),
    );
  const localGlobalTransformLookup = useLocalGlobalTransformLookup();
  const currentLocalStamp = useMemo(() => {
    const toLocal = localGlobalTransformLookup.toLocal[data.instanceId];
    return typeof toLocal === "function" ? toLocal(stamp) : stamp;
  }, [localGlobalTransformLookup, data.instanceId, stamp]);

  const computedRowData = useAnimationStore(
    useShallow((state: AnimationData) => state.derivedSnapshot?.rows?.[rowId]?.computed),
  );
  const latestComputedRowRef = useRef<any>(computedRowData);
  latestComputedRowRef.current = computedRowData;
  const instancedFrame = useMemo(
    () => computedRowData?.virtualFrames?.find((f) => f.stamp === currentLocalStamp),
    [computedRowData, currentLocalStamp],
  );
  const dragOriginYRef = useRef<number | null>(null);
  const dragActiveRef = useRef(false);
  const anchorValueOriginRef = useRef<number | null>(null);
  const appliedRangeRef = useRef<number>(1);
  const [displayValue, setDisplayValue] = useState<number | null>(null);

  const { animatableValue, track } = useAnimationStore(
    useShallow((state: AnimationData) => ({
      animatableValue: state.animatables[data.animatableId],
      track: state.tracks[data.trackId],
    })),
  );

  const value = useMemo(() => {
    if (storedValue === undefined) return undefined;
    if (typeof storedValue === "number") return storedValue;
    if (typeof storedValue === "string") return storedValue;
    if (typeof storedValue === "boolean") return storedValue;
    return undefined;
  }, [storedValue]);

  const defaultValue = useMemo(() => {
    if (animatableValue === undefined) return 0;
    if (typeof animatableValue.default === "number") return animatableValue.default;
    if (typeof animatableValue.default === "string") return animatableValue.default;
    if (typeof animatableValue.default === "boolean") return animatableValue.default;
    return undefined;
  }, [animatableValue]);

  const rawValue = value !== undefined ? value : defaultValue;

  const renderTransformer = data.iconCode === "rad" ? toDegrees : (v: number) => v;
  const renderInverse = data.iconCode === "rad" ? toRadians : (v: number) => v;

  const limits = useMemo(() => {
    if (animatableValue.type === "number") {
      return {
        min: (animatableValue as AnimatableNumber).constraints?.min ?? undefined,
        max: (animatableValue as AnimatableNumber).constraints?.max ?? undefined,
      };
    } else {
      return { min: undefined, max: undefined };
    }
  }, [animatableValue]);

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
    } else {
      return animatableValue?.name ?? "";
    }
  }, [track?.name, animatableValue?.name]);

  if (rawValue === undefined) return;

  if (data.type === "number" && typeof rawValue === "number") {
    return (
      <SliderNumberField
        onDragStartNative={(e, currentValue) => {
          if (playing || !data.editable || !active) return;

          dragOriginYRef.current = (e as MouseEvent).clientY;
          dragActiveRef.current = true;
          setDisplayValue(currentValue as number);

          const vb = computedRowData?.verticalBounds;
          const valueScale = vb
            ? { domain: [vb.min, vb.max] as [number, number], clamp: true }
            : undefined;

          // Initialize anchor value origin (convert from slider space to actual value space)
          const anchorActual = renderInverse(currentValue as number);
          anchorValueOriginRef.current = anchorActual;
          appliedRangeRef.current =
            vb && Number.isFinite(vb.max - vb.min) && vb.max - vb.min !== 0 ? vb.max - vb.min : 1;

          const startWithFrame = (frame: InstancedFrameInfo) => {
            if (!frame) return;
            // Ensure selection includes the anchor keypoint for drag previews
            const selectionFrame = computedRowData?.selection?.find((f) => f.id === frame.id);
            clickMarker(selectionFrame?.points ?? [], rowId, frame.id);
            startDrag({
              axis: "vertical",
              origin: { x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY },
              markerId: frame.id,
              rowId,
              valueScale,
            });
          };

          if (instancedFrame) {
            startWithFrame(instancedFrame);
            return;
          }

          // No key at current time: insert, then resolve marker and start drag
          insertKeypointAtWorldStamp(data.trackId, stamp, data.instanceId);

          requestAnimationFrame(() => {
            const frames = latestComputedRowRef.current?.virtualFrames ?? [];
            const epsilon = 1e-6;
            const frame: InstancedFrameInfo =
              frames.find(
                (f: InstancedFrameInfo) =>
                  Math.abs(f.stamp - currentLocalStamp) < epsilon &&
                  f.points.some((p) => p.trackId === data.trackId),
              ) ||
              frames
                .filter((f: InstancedFrameInfo) => f.points.some((p) => p.trackId === data.trackId))
                .sort(
                  (a: InstancedFrameInfo, b: InstancedFrameInfo) =>
                    Math.abs(a.stamp - currentLocalStamp) - Math.abs(b.stamp - currentLocalStamp),
                )[0];

            startWithFrame(frame);
          });
        }}
        onDragMoveNative={(e, currentValue) => {
          if (!dragActiveRef.current) return;
          setDisplayValue(currentValue as number);

          // Convert slider value back to actual value, compute normalized delta against anchor
          const currentActual = renderInverse(currentValue as number);
          const originActual =
            anchorValueOriginRef.current !== null ? anchorValueOriginRef.current : currentActual;
          anchorValueOriginRef.current = originActual;

          const range = appliedRangeRef.current || 1;
          const normalizedValueDelta = range !== 0 ? (currentActual - originActual) / range : 0;

          updateDrag({
            pointer: { x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY },
            normalizedValueDelta,
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
          dragOriginYRef.current = null;
          setDisplayValue(null);
          commitDrag();
        }}
        size={Size.Sm}
        strictText={false}
        strictSlider={
          limits.min !== undefined &&
          limits.max !== undefined &&
          limits.min !== -Infinity &&
          limits.max !== Infinity
        }
        disabled={playing || !data.editable || !active}
        value={displayValue !== null ? displayValue : renderTransformer(rawValue)}
        min={limits.min !== undefined ? renderTransformer(limits.min) : undefined}
        max={limits.max !== undefined ? renderTransformer(limits.max) : undefined}
        color={color}
        onChange={(v) => {
          if (dragActiveRef.current) return;
          onChange(renderInverse(v));
        }}
        label={label}
        onLabelChange={track ? (v) => updateTrack({ id: track.id, name: v }) : undefined}
        highlight={emphasis}
        units={data.iconCode === "rad" ? "°" : animatableValue.pub?.units}
        onHighlightChange={onEmphasisChange}
        wrapperClassName="flex-1"
        className="flex-1"
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
