import { MouseEventHandler, type ReactNode, useCallback } from "react";
import { IconPlayerPlay } from "@tabler/icons-react";
import { IconButton, IconPlayerEndBounds } from "@semio/ui";
import { useShallow } from "zustand/react/shallow";
import type { AnimationActions } from "./store-types";
import { SemanticTime } from "./store-types";
import { useAnimationStore } from "./hooks/use-animation-store";

export interface SkipButtonProps {
  semanticTime: SemanticTime;
  onMouseEnter?: MouseEventHandler<HTMLButtonElement>;
  onMouseLeave?: MouseEventHandler<HTMLButtonElement>;
}

export function SkipButton({
  semanticTime,
  onMouseEnter,
  onMouseLeave,
}: SkipButtonProps): ReactNode {
  const skip = useAnimationStore(
    useCallback(
      (state: AnimationActions) => {
        if (semanticTime === SemanticTime.Forward) {
          return state.skipToNextKeyframe;
        } else if (semanticTime === SemanticTime.Backward) {
          return state.skipToPrevKeyframe;
        } else if (semanticTime === SemanticTime.BoundsStart) {
          return state.skipToStart;
        } else if (semanticTime === SemanticTime.BoundsEnd) {
          return state.skipToEnd;
        }
      },
      [semanticTime],
    ),
  );

  const [addPreview, removePreview] = useAnimationStore(
    useShallow((state: AnimationActions) => [
      state.addPreview,
      state.removePreview,
    ]),
  );

  return (
    <IconButton
      size="fit"
      color="#737373"
      onClick={() => skip?.()}
      onMouseEnter={(e) => {
        onMouseEnter?.(e);
        addPreview({ stamp: 0, semanticTime, label: "" });
      }}
      onMouseLeave={(e) => {
        onMouseLeave?.(e);
        removePreview((p) => p.semanticTime === semanticTime);
      }}
    >
      {ICONS[semanticTime]}
    </IconButton>
  );
}

const ICONS: Record<SemanticTime, ReactNode> = {
  [SemanticTime.Forward]: <IconPlayerPlay className="rotate-0" size="10px" />,
  [SemanticTime.Backward]: (
    <IconPlayerPlay className="rotate-180" size="10px" />
  ),
  [SemanticTime.BoundsStart]: (
    <IconPlayerEndBounds className="rotate-180" size="12px" />
  ),
  [SemanticTime.BoundsEnd]: <IconPlayerEndBounds size="12px" />,
  [SemanticTime.Duration]: <IconPlayerPlay size="10px" />,
  [SemanticTime.Current]: <IconPlayerPlay size="10px" />,
  [SemanticTime.Hover]: <IconPlayerPlay size="10px" />,
};
