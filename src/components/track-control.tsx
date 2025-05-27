import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { clsx } from "clsx";
import { pick } from "lodash";
import { IconPlayerPlay, Button, IconKey } from "@semio/ui";
import { usePlayerStore } from "@semio/utils";
import { shallow } from "zustand/shallow";
import { useAnimationStore, usePlayerSubscription } from "../hooks";
import { computeNextTime, computePreviousTime } from "../functions";
import { type AnimationData, type AnimationActions } from "../store-types";
import { SemanticTime } from "../types";

export interface TrackControlProps {
  color?: string;
  filled?: boolean;
  onHexClick?: () => void;
  animationId?: string;
  namespaceId: string;
  trackIds: string[];
  disabled?: boolean;
}

export function TrackControl({
  color = "#737373",
  filled = false,
  onHexClick,
  animationId,
  namespaceId,
  trackIds,
  disabled,
}: TrackControlProps) {
  const tracks = useAnimationStore(useShallow((state) => pick(state.tracks, trackIds)));
  const instances = useAnimationStore(useShallow((state) => state.namespaceInfo[namespaceId]));

  const bounds = usePlayerStore(useShallow((state) => state.player.bounds));

  const [prevKeyframeTime, setPrevKeyframeTime] = useState<number | undefined>(undefined);
  const [nextKeyframeTime, setNextKeyframeTime] = useState<number | undefined>(undefined);

  usePlayerSubscription(
    (state) => state.player.stamp,
    (stamp) => {
      const prev = computePreviousTime(tracks, instances, stamp, bounds, true);
      const next = computeNextTime(tracks, instances, stamp, bounds, true);
      setPrevKeyframeTime(prev);
      setNextKeyframeTime(next);
    },
    shallow,
  );

  const enabledBack = prevKeyframeTime !== undefined;
  const enabledForward = nextKeyframeTime !== undefined;
  const widgetDisabled = disabled || !animationId;

  const [backFn, forwardFn] = useAnimationStore(
    useShallow((state: AnimationData & AnimationActions) => [
      state.skipToPrevKeyframe,
      state.skipToNextKeyframe,
    ]),
  );

  const dashed = trackIds !== undefined && (!enabledBack || !enabledForward);

  const [addPreview, removePreview] = useAnimationStore(
    useShallow((state: AnimationData & AnimationActions) => [
      state.addPreview,
      state.removePreview,
    ]),
  );

  const [hovered, setHovered] = useState(false);

  const center = getCenter(hovered, filled);

  return (
    <div className={clsx("min-w-16 h-7 rounded-xs grid grid-cols-3 items-center justify-between")}>
      <Button
        size="fit"
        color={color}
        disabled={!enabledBack || widgetDisabled}
        onClick={widgetDisabled ? noOp : () => backFn(animationId, [namespaceId], trackIds, true)}
        onMouseEnter={() => {
          if (widgetDisabled) return;
          addPreview({
            stamp: prevKeyframeTime ?? 0,
            semanticTime: SemanticTime.Backward,
            label: "Previous Keyed Frame",
          });
        }}
        onMouseLeave={() => {
          if (widgetDisabled) return;
          removePreview((p) => p.semanticTime === SemanticTime.Backward);
        }}
        leftIcon={<IconPlayerPlay className="rotate-180" size="14px" />}
        visuals="inverted"
      />
      <Button
        size="fit"
        disabled={widgetDisabled}
        color={color}
        onClick={widgetDisabled ? noOp : onHexClick}
        deemphasize={!trackIds}
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
        disabled={!enabledForward || widgetDisabled}
        onClick={
          widgetDisabled ? noOp : () => forwardFn(animationId, [namespaceId], trackIds, true)
        }
        onMouseEnter={() => {
          if (widgetDisabled) return;
          addPreview({
            stamp: nextKeyframeTime ?? 0,
            semanticTime: SemanticTime.Forward,
            label: "Next Keyed Frame",
          });
        }}
        onMouseLeave={() => {
          if (widgetDisabled) return;
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
