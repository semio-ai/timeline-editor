import type { ReactNode } from "react";
import { useMediaQuery } from "@semio/utils";
import { IconButton } from "@semio/ui";
import {
  IconPlayerPauseFilled,
  IconPlayerPlayFilled,
} from "@tabler/icons-react";
import { clsx } from "clsx";
import { useShallow } from "zustand/react/shallow";
import { useAnimationStore } from "./hooks/use-animation-store";
import { TimeDisplay, TimeDisplayType } from "./time-display";
import { SkipButton, SkipDirection } from "./skip-button";
import { AnimationActions, AnimationData } from "./store-types";

export function Controls(): ReactNode {
  const { playPlayer, pausePlayer, running } = useAnimationStore(
    useShallow((state: AnimationActions & AnimationData) => ({
      playPlayer: state.playPlayer,
      pausePlayer: state.pausePlayer,
      running: state.player.running,
    })),
  );

  const smallScreen = useMediaQuery("(max-width: 768px)");
  const xsmallScreen = useMediaQuery("(max-width: 640px)");

  return (
    <div className="justify-between items-center p-1 flex">
      <div className="flex justify-center items-center gap-2">
        <SkipButton direction={SkipDirection.BoundsStart} />
        {!xsmallScreen && <TimeDisplay type={TimeDisplayType.BoundsStart} />}
      </div>
      <div className="flex justify-center items-center gap-2">
        {!smallScreen && <TimeDisplay type={TimeDisplayType.Forward} />}
        <SkipButton direction={SkipDirection.Backward} />

        <div
          className={clsx(
            "flex transition-all justify-center items-center h-9 gap-2",
            // running ? "w-10" : "w-40",
          )}
        >
          <IconButton
            onClick={() => {
              if (running) {
                pausePlayer();
              } else {
                playPlayer(-1);
              }
            }}
          >
            {running ? (
              <IconPlayerPauseFilled />
            ) : (
              <IconPlayerPlayFilled
                className="transform rotate-180"
                // style={{ transform: "rotate(180deg)" }}
              />
            )}
          </IconButton>
          <div className="items-center p-2">
            <TimeDisplay type={TimeDisplayType.Current} />
          </div>
          <IconButton
            onClick={() => {
              if (running) {
                pausePlayer();
              } else {
                playPlayer(1);
              }
            }}
          >
            {running ? <IconPlayerPauseFilled /> : <IconPlayerPlayFilled />}
          </IconButton>
        </div>
        <SkipButton direction={SkipDirection.Forward} />
        {!smallScreen && <TimeDisplay type={TimeDisplayType.Forward} />}
      </div>
      <div className="flex justify-center items-center gap-2">
        {!xsmallScreen && <TimeDisplay type={TimeDisplayType.BoundsEnd} />}
        <SkipButton direction={SkipDirection.BoundsEnd} />
      </div>
    </div>
  );
}
