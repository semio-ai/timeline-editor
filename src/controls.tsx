import type { ReactNode } from "react";
import { ActionIcon, Group } from "@mantine/core";
import {
  IconPlayerPauseFilled,
  IconPlayerPlayFilled,
  // IconPointFilled,
} from "@tabler/icons-react";
import { clsx } from "clsx";
import { useShallow } from "zustand/react/shallow";
import { type AnimationStore } from "./store";
import { useAnimationStore } from "./hooks/use-animation-store";
import { TimeDisplay, TimeDisplayType } from "./time-display";
import { SkipButton, SkipDirection } from "./skip-button";
import { AnimationActions, AnimationData } from "./store-types";
import { IconButton } from "@semio/ui";

export function Controls(): ReactNode {
  const { playPlayer, pausePlayer, running } = useAnimationStore(
    useShallow((state: AnimationActions & AnimationData) => ({
      playPlayer: state.playPlayer,
      pausePlayer: state.pausePlayer,
      running: state.player.running,
    })),
  );

  return (
    <div className="justify-between items-center p-1 flex">
      <div className="flex justify-center items-center">
        <SkipButton direction={SkipDirection.BOUNDS_START} />
        <TimeDisplay type={TimeDisplayType.BOUNDS_START} />
      </div>
      <div className="flex justify-center items-center">
        <SkipButton direction={SkipDirection.BACKWARD} />

        <div
          className={clsx(
            "flex transition-all justify-center items-center h-9",
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
            <TimeDisplay type={TimeDisplayType.CURRENT} />
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
        <SkipButton direction={SkipDirection.FORWARD} />
      </div>
      <div className="flex justify-center items-center">
        <TimeDisplay type={TimeDisplayType.BOUNDS_END} />
        <SkipButton direction={SkipDirection.BOUNDS_END} />
      </div>
    </div>
    // <Group
    //   align="center"
    //   justify="center"
    //   style={{
    //     // height: 15,
    //     alignItems: "center",
    //     justifyContent: "space-between",
    //     padding: 5,
    //   }}
    // >
    //   <Group
    //     align="center"
    //     justify="center"
    //     style={{
    //       // height: 15,
    //       alignItems: "center",
    //       justifyContent: "center",
    //       paddingTop: 0,
    //       paddingBottom: 0,
    //     }}
    //   >
    //     <SkipButton direction={SkipDirection.BOUNDS_START} />
    //     <TimeDisplay type={TimeDisplayType.BOUNDS_START} />
    //   </Group>
    //   <Group
    //     align="center"
    //     justify="center"
    //     style={{
    //       // height: 15,
    //       alignItems: "center",
    //       justifyContent: "center",
    //       paddingTop: 0,
    //       paddingBottom: 0,
    //     }}
    //   >
    //     <TimeDisplay type={TimeDisplayType.Current} />
    //     <SkipButton direction={SkipDirection.Backward} />
    //     <ActionIcon
    //       color="gray"
    //       onClick={() => {
    //         if (running) {
    //           pausePlayer();
    //         } else {
    //           playPlayer(-1);
    //         }
    //       }}
    //       radius={0}
    //       size="sm"
    //       variant="transparent"
    //     >
    //       {running ? (
    //         <IconPlayerPauseFilled />
    //       ) : (
    //         <IconPlayerPlayFilled style={{ transform: "rotate(180deg)" }} />
    //       )}
    //     </ActionIcon>
    //     {/* <ActionIcon
    //     color="gray"
    //     onClick={() => {
    //       addAutoKeyframe();
    //     }}
    //     radius={0}
    //     size="sm"
    //     variant="transparent"
    //   >
    //     <IconPointFilled />
    //   </ActionIcon> */}
    //     <TimeDisplay type={TimeDisplayType.Current} />
    //     <ActionIcon
    //       color="gray"
    //       onClick={() => {
    //         if (running) {
    //           pausePlayer();
    //         } else {
    //           playPlayer(1);
    //         }
    //       }}
    //       radius={0}
    //       size="sm"
    //       variant="transparent"
    //     >
    //       {running ? <IconPlayerPauseFilled /> : <IconPlayerPlayFilled />}
    //     </ActionIcon>
    //     <SkipButton direction={SkipDirection.Forward} />
    //     <TimeDisplay type={TimeDisplayType.Current} />
    //   </Group>
    //   <Group
    //     align="center"
    //     justify="center"
    //     style={{
    //       // height: 15,
    //       alignItems: "center",
    //       justifyContent: "center",
    //       paddingTop: 0,
    //       paddingBottom: 0,
    //     }}
    //   >
    //     <TimeDisplay type={TimeDisplayType.BOUNDS_END} />
    //     <SkipButton direction={SkipDirection.BOUNDS_END} />
    //   </Group>
    // </Group>
  );
}
