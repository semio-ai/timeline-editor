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
        <SkipButton direction={SkipDirection.WindowStart} />
        <TimeDisplay type={TimeDisplayType.WindowStart} />
      </div>
      <div className="flex justify-center items-center">
        <SkipButton direction={SkipDirection.Backward} />

        <div
          className={clsx(
            "flex transition-all justify-center items-center h-16",
            running ? "w-10" : "w-40",
          )}
        >
          {running ? (
            <IconButton onClick={pausePlayer}>
              <IconPlayerPauseFilled />
            </IconButton>
          ) : (
            <>
              <IconButton onClick={() => playPlayer(-1)}>
                <IconPlayerPlayFilled style={{ transform: "rotate(180deg)" }} />
              </IconButton>
              <div className="items-center p-2">
                <TimeDisplay type={TimeDisplayType.Current} />
              </div>
              <IconButton onClick={() => playPlayer(1)}>
                <IconPlayerPlayFilled />
              </IconButton>
            </>
          )}
        </div>
        <SkipButton direction={SkipDirection.Forward} />
      </div>
      <div className="flex justify-center items-center">
        <TimeDisplay type={TimeDisplayType.WindowEnd} />
        <SkipButton direction={SkipDirection.WindowEnd} />
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
    //     <SkipButton direction={SkipDirection.WindowStart} />
    //     <TimeDisplay type={TimeDisplayType.WindowStart} />
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
    //     <TimeDisplay type={TimeDisplayType.WindowEnd} />
    //     <SkipButton direction={SkipDirection.WindowEnd} />
    //   </Group>
    // </Group>
  );
}
