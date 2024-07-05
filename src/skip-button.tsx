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
  Forward = "forward",
  Backward = "Backward",
  BoundsStart = "bounds-start",
  BoundsEnd = "bounds-end",
}

export interface SkipButtonProps {
  direction: SkipDirection;
}

export function SkipButton({ direction }: SkipButtonProps): ReactNode {
  const skip = useAnimationStore(
    useCallback(
      (state: AnimationActions) => {
        if (direction === SkipDirection.Forward) {
          return state.skipToNextKeyframe;
        } else if (direction === SkipDirection.Backward) {
          return state.skipToPrevKeyframe;
        } else if (direction === SkipDirection.BoundsStart) {
          return state.skipToStart;
        } else if (direction === SkipDirection.BoundsEnd) {
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
  [SkipDirection.Forward]: <IconPlayerTrackNextFilled />,
  [SkipDirection.Backward]: <IconPlayerTrackPrevFilled />,
  [SkipDirection.BoundsStart]: <IconPlayerSkipBackFilled />,
  [SkipDirection.BoundsEnd]: <IconPlayerSkipForwardFilled />,
};
