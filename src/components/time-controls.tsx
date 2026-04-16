import type { ReactNode } from "react";
import { Button } from "@semio/ui";
import { usePlayerStore } from "@semio/utils";
import { Play, Pause } from "@solar-icons/react-perf/Bold";
import { useShallow } from "zustand/react/shallow";
import { useAnimationStore } from "../hooks";
import { SemanticTime } from "../types";
import { AnimationData } from "../store-types";
import { TimeDisplay } from "./time-display";
import { SkipButton } from "./skip-button";

export function TimeControls(): ReactNode {
  const previews = useAnimationStore(useShallow((state: AnimationData) => state.previews));
  const nonHoverPreviews = previews.filter((p) => p.semanticTime !== SemanticTime.Hover);
  const { playPlayer, pausePlayer, running } = usePlayerStore(
    useShallow((state) => ({
      playPlayer: state.playPlayer,
      pausePlayer: state.pausePlayer,
      running: state.player.running,
    })),
  );

  return (
    <>
      <div className="flex w-full items-center">
        <TimeDisplay
          valueOverride={
            nonHoverPreviews.length === 1 &&
            [SemanticTime.Backward, SemanticTime.Forward].includes(nonHoverPreviews[0].semanticTime)
              ? nonHoverPreviews[0].stamp
              : undefined
          }
          semanticTime={
            nonHoverPreviews.length === 1 ? nonHoverPreviews[0].semanticTime : SemanticTime.Current
          }
        />
      </div>
      <SkipButton semanticTime={SemanticTime.BoundsStart} />
      <Button
        size="fit"
        onClick={() => {
          if (running) {
            pausePlayer();
          } else {
            playPlayer();
          }
        }}
        leftIcon={running ? <Pause size="18px" /> : <Play size="18px" />}
        visuals="inverted"
      />
      <SkipButton semanticTime={SemanticTime.BoundsEnd} />
    </>
  );
}
