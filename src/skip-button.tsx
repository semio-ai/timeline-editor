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
  Backward = "backward",
  WindowStart = "window-start",
  WindowEnd = "window-end",
}

export interface SkipButtonProps {
  direction: SkipDirection;
}

export function SkipButton({ direction }: SkipButtonProps): ReactNode {
  const skip = useAnimationStore(
    useCallback(
      (state: AnimationActions) =>
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- Fixme
        direction === "forward" ? state.nextKeyframe : state.prevKeyframe,
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
  [SkipDirection.WindowStart]: <IconPlayerSkipBackFilled />,
  [SkipDirection.WindowEnd]: <IconPlayerSkipForwardFilled />,
};
