import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { clsx } from "clsx";
import { IconPlayerPlay, IconButton, IconKey } from "@semio/ui";
import { useAnimationStore } from "./hooks/use-animation-store";
import { type AnimationData, type AnimationActions } from "./store-types";

export interface TrackControlProps {
  color?: string;
  filled?: boolean;
  onHexClick?: () => void;
  trackIds?: string[];
}

export function TrackControl({
  color = "#737373",
  filled = false,
  onHexClick,
  trackIds,
}: TrackControlProps) {
  const filter = trackIds || [];
  const [enabledBack, backFn] = useAnimationStore(
    useShallow((state: AnimationData & AnimationActions) => [
      trackIds ? state.prevKeyframeTime(state, filter) !== undefined : false,
      state.skipToPrevKeyframe,
    ]),
  );
  const [enabledForward, forwardFn] = useAnimationStore(
    useShallow((state: AnimationData & AnimationActions) => [
      trackIds ? state.nextKeyframeTime(state, filter) !== undefined : false,
      state.skipToNextKeyframe,
    ]),
  );

  const dashed = trackIds !== undefined && (!enabledBack || !enabledForward);

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
        onClick={() => backFn(filter)}
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
        onClick={() => forwardFn(filter)}
      >
        <IconPlayerPlay size="10px" />
      </IconButton>
    </div>
  );
}

function getCenter(
  hovered: boolean,
  filled: boolean,
): "plus" | "minus" | undefined {
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
