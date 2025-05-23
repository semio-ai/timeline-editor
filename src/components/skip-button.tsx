import { MouseEventHandler, type ReactNode, useCallback } from "react";
import { IconPlayerPlay } from "@tabler/icons-react";
import { Button, IconPlayerEndBounds } from "@semio/ui";
import { useShallow } from "zustand/react/shallow";
import type { AnimationActions } from "../store-types";
import { SemanticTime } from "../types";
import { useAnimationStore } from "../hooks";

export interface SkipButtonProps {
  animationId: string;
  namespaceIds: string[];
  trackIds: string[];
  semanticTime: SemanticTime;
  onMouseEnter?: MouseEventHandler<HTMLButtonElement>;
  onMouseLeave?: MouseEventHandler<HTMLButtonElement>;
}

export function SkipButton({
  animationId,
  namespaceIds,
  trackIds,
  semanticTime,
  onMouseEnter,
  onMouseLeave,
}: SkipButtonProps): ReactNode {
  const [skipToNextKeyframe, skiptToPrevKeyframe, skipToStart, skipToEnd] = useAnimationStore(
    useShallow((state: AnimationActions) => [
      state.skipToNextKeyframe,
      state.skipToPrevKeyframe,
      state.skipToStart,
      state.skipToEnd,
    ]),
  );

  const skip = useCallback(() => {
    if (semanticTime === SemanticTime.Forward) {
      skipToNextKeyframe(animationId, namespaceIds, trackIds, true);
    } else if (semanticTime === SemanticTime.Backward) {
      skiptToPrevKeyframe(animationId, namespaceIds, trackIds, true);
    } else if (semanticTime === SemanticTime.BoundsStart) {
      skipToStart();
    } else if (semanticTime === SemanticTime.BoundsEnd) {
      skipToEnd();
    }
  }, [
    semanticTime,
    skipToNextKeyframe,
    skiptToPrevKeyframe,
    skipToStart,
    skipToEnd,
    animationId,
    namespaceIds,
    trackIds,
  ]);

  const [addPreview, removePreview] = useAnimationStore(
    useShallow((state: AnimationActions) => [state.addPreview, state.removePreview]),
  );

  return (
    <Button
      invert
      size="fit"
      onClick={() => skip?.()}
      onMouseEnter={(e) => {
        onMouseEnter?.(e);
        addPreview({ stamp: 0, semanticTime, label: "" });
      }}
      onMouseLeave={(e) => {
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
