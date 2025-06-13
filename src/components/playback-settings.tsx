import { clsx } from "clsx";
import { Button, Dropdown, NestedLabel, NestedRadio } from "@semio/ui";
import { usePlayerStore } from "@semio/utils";
import { useShallow } from "zustand/shallow";
import {
  IconArrowAutofitLeft,
  IconArrowAutofitRight,
  IconPlayerPlay,
  IconRepeat,
  IconArrowBounce,
  IconNumber1,
  IconMultiplier05x,
  IconMultiplier1x,
  IconMultiplier15x,
  IconMultiplier2x,
} from "@tabler/icons-react";

export function PlaybackSettings() {
  const { direction, style, speed } = usePlayerStore(
    useShallow((state) => ({
      direction: state.player.direction,
      style: state.player.playback,
      speed: state.player.speed,
    })),
  );

  console.log({ direction, style, speed });

  const { setPlayback, setDirection, setSpeed } = usePlayerStore(
    useShallow((state) => ({
      setPlayback: state.updatePlaybackStyle,
      setDirection: state.updateDirection,
      setSpeed: state.updateSpeed,
    })),
  );

  let styleIcon;
  if (style === "loop") {
    styleIcon = <IconRepeat size="14px" />;
  } else if (style === "bounce") {
    styleIcon = <IconArrowBounce size="14px" />;
  } else {
    styleIcon = <IconNumber1 size="14px" />;
  }

  let speedIcon;
  if (speed === 0.5) {
    speedIcon = <IconMultiplier05x size="14px" />;
  } else if (speed === 1) {
    speedIcon = <IconMultiplier1x size="14px" />;
  } else if (speed === 1.5) {
    speedIcon = <IconMultiplier15x size="14px" />;
  } else {
    speedIcon = <IconMultiplier2x size="14px" />;
  }

  return (
    <div className="flex flex-1 flex-row h-8 items-center gap-1 pl-1">
      <div
        className={clsx("min-w-16 h-7 rounded-xs grid grid-cols-3 items-center justify-between")}
      >
        <Dropdown
          trigger={
            <Button
              size="fit"
              leftIcon={
                direction === "forward" ? (
                  <IconArrowAutofitRight className="h-3/5 aspect-square" />
                ) : (
                  <IconArrowAutofitLeft className="h-3/5 aspect-square" />
                )
              }
              visuals="inverted"
            />
          }
        >
          <NestedLabel>Playback Direction</NestedLabel>
          <NestedRadio
            value={direction}
            options={[
              {
                label: "Forward",
                value: "forward",
                icon: <IconArrowAutofitRight className="h-3/5 aspect-square" />,
              },
              {
                label: "Reverse",
                value: "reverse",
                icon: <IconArrowAutofitLeft className="h-3/5 aspect-square" />,
              },
            ]}
            onChange={(v) => {
              setDirection(v as "forward" | "reverse");
            }}
          />
        </Dropdown>

        <Dropdown trigger={<Button size="fit" leftIcon={styleIcon} visuals="inverted" />}>
          <NestedLabel>Playback Style</NestedLabel>
          <NestedRadio
            value={style}
            options={[
              {
                label: "Loop",
                value: "loop",
                icon: <IconRepeat className="h-3/5 aspect-square" />,
              },
              {
                label: "Bounce",
                value: "bounce",
                icon: <IconArrowBounce className="h-3/5 aspect-square" />,
              },
              {
                label: "Once",
                value: "once",
                icon: <IconNumber1 className="h-3/5 aspect-square" />,
              },
            ]}
            onChange={(v) => {
              setPlayback(v as "loop" | "bounce" | "once");
            }}
          />
        </Dropdown>

        <Dropdown trigger={<Button size="fit" leftIcon={speedIcon} visuals="inverted" />}>
          <NestedLabel>Playback Speed</NestedLabel>
          <NestedRadio
            value={speed.toString()}
            options={[
              {
                label: "0.5x",
                value: "0.5",
                icon: <IconMultiplier05x className="h-3/5 aspect-square" />,
              },
              {
                label: "1x",
                value: "1",
                icon: <IconMultiplier1x className="h-3/5 aspect-square" />,
              },
              {
                label: "1.5x",
                value: "1.5",
                icon: <IconMultiplier15x className="h-3/5 aspect-square" />,
              },
              {
                label: "2x",
                value: "2",
                icon: <IconMultiplier2x className="h-3/5 aspect-square" />,
              },
            ]}
            onChange={(v) => {
              setSpeed(parseFloat(v));
            }}
          />
        </Dropdown>
      </div>
    </div>
  );
}
