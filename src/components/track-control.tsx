import { useState, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import { clsx } from "clsx";
import { pick } from "lodash";
import { IconPlayerPlay, IconButton, IconKey } from "@semio/ui";
import { shallow } from "zustand/shallow";
import { useAnimationStore, useStoreSubscription } from "../hooks";
import { computeNextTime, computePreviousTime } from "../functions";
import { type AnimationData, type AnimationActions } from "../store-types";
import { SemanticTime } from "../store-types";

export interface TrackControlProps {
  color?: string;
  filled?: boolean;
  onHexClick?: () => void;
  animationId: string;
  namespaceId: string;
  trackIds: string[];
}

export function TrackControl({
  color = "#737373",
  filled = false,
  onHexClick,
  animationId,
  namespaceId,
  trackIds,
}: TrackControlProps) {
  const tracks = useAnimationStore(useShallow((state) => pick(state.tracks, trackIds)));
  const namespaces = useAnimationStore(
    useShallow((state) => pick(state.animations[animationId].instances, [namespaceId])),
  );

  const bounds = useAnimationStore(useShallow((state) => state.player.bounds));

  const prevKeyframeTime = useRef<number | undefined>(undefined);
  const nextKeyframeTime = useRef<number | undefined>(undefined);

  useStoreSubscription(
    (state) => state.player.stamp,
    (stamp) => {
      const prev = computePreviousTime(tracks, namespaces, stamp, bounds, true);
      const next = computeNextTime(tracks, namespaces, stamp, bounds, true);
      prevKeyframeTime.current = prev;
      nextKeyframeTime.current = next;
    },
    shallow,
  );

  const enabledBack = prevKeyframeTime.current !== undefined;
  const enabledForward = nextKeyframeTime.current !== undefined;

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
    <div
      className={clsx(
        "w-fit h-5 flex flex-row gap-0 pl-1 pr-1 pt-2 pb-2 items-center justify-between",
      )}
    >
      <IconButton
        size="fit"
        color={color}
        disabled={!enabledBack}
        onClick={() => backFn(animationId, [namespaceId], trackIds, true)}
        onMouseEnter={() => {
          addPreview({
            stamp: prevKeyframeTime.current ?? 0,
            semanticTime: SemanticTime.Backward,
            label: "Previous Keyed Frame",
          });
        }}
        onMouseLeave={() => {
          removePreview((p) => p.semanticTime === SemanticTime.Backward);
        }}
      >
        <IconPlayerPlay className="rotate-180" size="10px" />
      </IconButton>
      <IconButton
        size="fit"
        color={color}
        onClick={onHexClick}
        deemphasize={!trackIds}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <IconKey
          size="16px"
          fillOpacity={getFillOpacity(hovered, filled)}
          dashed={!filled && dashed}
          center={center}
        />
      </IconButton>
      <IconButton
        size="fit"
        color={color}
        disabled={!enabledForward}
        onClick={() => forwardFn(animationId, [namespaceId], trackIds, true)}
        onMouseEnter={() => {
          addPreview({
            stamp: nextKeyframeTime.current ?? 0,
            semanticTime: SemanticTime.Forward,
            label: "Next Keyed Frame",
          });
        }}
        onMouseLeave={() => {
          removePreview((p) => p.semanticTime === SemanticTime.Forward);
        }}
      >
        <IconPlayerPlay size="10px" />
      </IconButton>
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
