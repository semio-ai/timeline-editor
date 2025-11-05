import { useMemo, useState, useRef, useCallback, useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { uniq } from "lodash";
import { clsx } from "clsx";
import { IconPlayerPlay, Button, IconKey } from "@semio/ui";
import { usePlayerStore } from "@semio/utils";
import { shallow } from "zustand/shallow";
import { useAnimationStore, usePlayerSubscription } from "../hooks";
import { computeNextTime, computePreviousTime } from "../functions";
import { type AnimationData, type AnimationActions } from "../store-types";
import { SemanticTime, SourceRow } from "../types";
import { resolveComputedRowData } from "../utils/resolve-row-data";

export interface TrackControlProps {
  color?: string;
  filled?: boolean;
  onHexClick?: () => void;
  source: SourceRow;
  disabled?: boolean;
}

export function TrackControl({
  color = "#737373",
  filled = false,
  onHexClick,
  source,
  disabled,
}: TrackControlProps) {
  const computedData = useAnimationStore(
    useShallow((state: AnimationData) => resolveComputedRowData(state, source.id)),
  );

  const bounds = usePlayerStore(useShallow((state) => state.player.bounds));

  const [prevKeyframeTime, setPrevKeyframeTime] = useState<number | undefined>(undefined);
  const [nextKeyframeTime, setNextKeyframeTime] = useState<number | undefined>(undefined);

  const computedDataRef = useRef(computedData);
  useEffect(() => {
    computedDataRef.current = computedData;
  }, [computedData]);

  const boundsRef = useRef(bounds);
  useEffect(() => {
    boundsRef.current = bounds;
  }, [bounds]);

  const playerSelector = useCallback(
    (state: any) => ({ running: state.player.running, stamp: state.player.stamp }),
    [],
  );

  const playerCallback = useCallback(({ running, stamp }: { running: boolean; stamp: number }) => {
    const currentComputed = computedDataRef.current;
    const currentBounds = boundsRef.current;

    if (running || currentComputed === undefined) {
      setPrevKeyframeTime((v) => (v !== undefined ? undefined : v));
      setNextKeyframeTime((v) => (v !== undefined ? undefined : v));
    } else {
      const prev = computePreviousTime(currentComputed.virtualFrames, stamp, currentBounds, true);
      const next = computeNextTime(currentComputed.virtualFrames, stamp, currentBounds, true);
      setPrevKeyframeTime((p) => (p !== prev ? prev : p));
      setNextKeyframeTime((n) => (n !== next ? next : n));
    }
  }, []);

  usePlayerSubscription(playerSelector, playerCallback, shallow);

  const enabledBack = prevKeyframeTime !== undefined;
  const enabledForward = nextKeyframeTime !== undefined;

  const [backFn, forwardFn] = useAnimationStore(
    useShallow((state: AnimationData & AnimationActions) => [
      state.skipToPrevKeyframe,
      state.skipToNextKeyframe,
    ]),
  );

  const dashed = !enabledBack || !enabledForward;

  const [addPreview, removePreview] = useAnimationStore(
    useShallow((state: AnimationData & AnimationActions) => [
      state.addPreview,
      state.removePreview,
    ]),
  );

  const [hovered, setHovered] = useState(false);

  const trackIds = useMemo(() => {
    return uniq(source.data.map((data) => data.trackId));
  }, [source.data]);

  const center = getCenter(hovered, filled);

  return (
    <div className={clsx("min-w-16 h-7 rounded-xs grid grid-cols-3 items-center justify-between")}>
      <Button
        size="fit"
        color={color}
        disabled={!enabledBack || disabled}
        onClick={disabled ? noOp : () => backFn(source, true)}
        onMouseEnter={() => {
          if (disabled) return;
          addPreview({
            stamp: prevKeyframeTime ?? 0,
            semanticTime: SemanticTime.Backward,
            label: "Previous Keyed Frame",
          });
        }}
        onMouseLeave={() => {
          if (disabled) return;
          removePreview((p) => p.semanticTime === SemanticTime.Backward);
        }}
        leftIcon={<IconPlayerPlay className="rotate-180" size="14px" />}
        visuals="inverted"
      />
      <Button
        size="fit"
        disabled={disabled}
        color={color}
        onClick={disabled ? noOp : onHexClick}
        deemphasize={trackIds.length === 0}
        onMouseEnter={() => setHovered(!disabled)}
        onMouseLeave={() => setHovered(false)}
        leftIcon={
          <IconKey
            size="18px"
            fillOpacity={getFillOpacity(hovered, filled)}
            dashed={!filled && dashed}
            center={center}
          />
        }
        visuals="inverted"
      />
      <Button
        size="fit"
        color={color}
        disabled={!enabledForward || disabled}
        onClick={disabled ? noOp : () => forwardFn(source, true)}
        onMouseEnter={() => {
          if (disabled) return;
          addPreview({
            stamp: nextKeyframeTime ?? 0,
            semanticTime: SemanticTime.Forward,
            label: "Next Keyed Frame",
          });
        }}
        onMouseLeave={() => {
          if (disabled) return;
          removePreview((p) => p.semanticTime === SemanticTime.Forward);
        }}
        leftIcon={<IconPlayerPlay size="14px" />}
        visuals="inverted"
      />
    </div>
  );
}

function getCenter(hovered: boolean, filled: boolean): "plus" | "minus" | undefined {
  if (filled && hovered) {
    return "minus";
  } else if (!filled && hovered) {
    return "plus";
  } else {
    return undefined;
  }
}

function getFillOpacity(hovered: boolean, filled: boolean): number {
  if (hovered) {
    return 0.5;
  } else if (filled) {
    return 1;
  } else {
    return 0;
  }
}

function noOp() {}
