import { type ReactNode, useCallback } from "react";
import { IconButton } from "@semio/ui";
import {
  IconPlayerSkipBackFilled,
  IconPlayerSkipForwardFilled,
  IconPlayerTrackNextFilled,
  IconPlayerTrackPrevFilled,
} from "@tabler/icons-react";
import type { AnimationActions } from "./store-types";
import { useAnimationStore } from "./hooks/use-animation-store";

export enum SkipDirection {
  FORWARD = "forward",
  BACKWARD = "backward",
  BOUNDS_START = "bounds-start",
  BOUNDS_END = "bounds-end",
}

export interface SkipButtonProps {
  direction: SkipDirection;
}

export function SkipButton({ direction }: SkipButtonProps): ReactNode {
  const skip = useAnimationStore(
    useCallback(
      (state: AnimationActions) => {
        if (direction === SkipDirection.FORWARD) {
          return state.nextKeyframe;
        } else if (direction === SkipDirection.BACKWARD) {
          return state.prevKeyframe;
        } else if (direction === SkipDirection.BOUNDS_START) {
          return state.skipToStart;
        } else if (direction === SkipDirection.BOUNDS_END) {
          return state.skipToEnd;
        }
      },
      [direction],
    ),
  );

  return (
    <IconButton color="gray" onClick={skip}>
      {ICONS[direction]}
    </IconButton>
  );
}

const ICONS: Record<SkipDirection, ReactNode> = {
  [SkipDirection.FORWARD]: <IconPlayerTrackNextFilled />,
  [SkipDirection.BACKWARD]: <IconPlayerTrackPrevFilled />,
  [SkipDirection.BOUNDS_START]: <IconPlayerSkipBackFilled />,
  [SkipDirection.BOUNDS_END]: <IconPlayerSkipForwardFilled />,
};
