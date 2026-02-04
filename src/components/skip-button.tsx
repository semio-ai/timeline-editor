import { MouseEventHandler, type ReactNode, useCallback } from "react";
import { IconPlayerPlay } from "@tabler/icons-react";
import { Button, IconPlayerEndBounds } from "@semio/ui";
import { useShallow } from "zustand/react/shallow";
import type { AnimationActions, AnimationData } from "../store-types";
import { SemanticTime } from "../types";
import { useAnimationStore } from "../hooks";

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
  const sourceRow = useAnimationStore(
    useShallow((state: AnimationData) => state.instancedTrackSources.global),
  );

  const [skipToNextKeyframe, skiptToPrevKeyframe, skipToStart, skipToEnd] = useAnimationStore(
    useShallow((state: AnimationActions) => [
      state.skipToNextKeyframe,
      state.skipToPrevKeyframe,
      state.skipToStart,
      state.skipToEnd,
    ]),
  );

  const directionalDisabled =
    (semanticTime === SemanticTime.Forward || semanticTime === SemanticTime.Backward) && !sourceRow;

  const skip = useCallback(() => {
    if (directionalDisabled) return;
    if (semanticTime === SemanticTime.Forward) {
      if (!sourceRow) return;
      skipToNextKeyframe(sourceRow, true);
    } else if (semanticTime === SemanticTime.Backward) {
      if (!sourceRow) return;
      skiptToPrevKeyframe(sourceRow, true);
    } else if (semanticTime === SemanticTime.BoundsStart) {
      skipToStart();
    } else if (semanticTime === SemanticTime.BoundsEnd) {
      skipToEnd();
    }
  }, [
    directionalDisabled,
    sourceRow,
    semanticTime,
    skipToNextKeyframe,
    skiptToPrevKeyframe,
    skipToStart,
    skipToEnd,
  ]);

  const [addPreview, removePreview] = useAnimationStore(
    useShallow((state: AnimationActions) => [state.addPreview, state.removePreview]),
  );

  return (
    <Button
      visuals="inverted"
      size="fit"
      disabled={directionalDisabled}
      onClick={directionalDisabled ? undefined : () => skip?.()}
      onMouseEnter={(e) => {
        if (directionalDisabled) return;
        onMouseEnter?.(e);
        addPreview({ stamp: 0, semanticTime });
      }}
      onMouseLeave={(e) => {
        if (directionalDisabled) return;
        onMouseLeave?.(e);
        removePreview((p) => p.semanticTime === semanticTime);
      }}
      leftIcon={ICONS[semanticTime]}
    />
  );
}

const ICONS: Record<SemanticTime, ReactNode> = {
  [SemanticTime.Forward]: <IconPlayerPlay className="rotate-0" size="10px" />,
  [SemanticTime.Backward]: <IconPlayerPlay className="rotate-180" size="10px" />,
  [SemanticTime.BoundsStart]: <IconPlayerEndBounds className="rotate-180 mt-0.5" size="16px" />,
  [SemanticTime.BoundsEnd]: <IconPlayerEndBounds size="16px" />,
  [SemanticTime.Duration]: <IconPlayerPlay size="10px" />,
  [SemanticTime.Current]: <IconPlayerPlay size="10px" />,
  [SemanticTime.Hover]: <IconPlayerPlay size="10px" />,
};
