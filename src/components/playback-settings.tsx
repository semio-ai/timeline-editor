import { clsx } from "clsx";
import { ICON_CLASS_NAME, Select, Size, ToggleSquare, Variant } from "@semio/ui";
import { PlayerDirection, usePlayerStore } from "@semio/utils";
import { useShallow } from "zustand/shallow";
import {
  IconRepeat,
  IconArrowBounce,
  IconMultiplier05x,
  IconMultiplier1x,
  IconMultiplier15x,
  IconMultiplier2x,
  IconArrowNarrowRight,
} from "@tabler/icons-react";

export function PlaybackSettings() {
  const { direction, bounce, looping, speed } = usePlayerStore(
    useShallow((state) => ({
      direction: state.player.direction,
      bounce: state.player.bounce,
      looping: state.player.looping,
      speed: state.player.speed,
    })),
  );

  // Map bounce/looping combination to style for UI compatibility
  const { setBounce, setLooping, setDirection, setSpeed } = usePlayerStore(
    useShallow((state) => ({
      setBounce: state.updateBounce,
      setLooping: state.updateLooping,
      setDirection: state.updateDirection,
      setSpeed: state.updateSpeed,
    })),
  );

  return (
    <div className="flex flex-1 flex-row h-9 items-center gap-1 pl-1">
      <div
        className={clsx(
          "min-w-16 h-7 rounded-xs grid grid-cols-3 gap-1 items-center justify-around px-1",
        )}
      >
        <ToggleSquare
          sizing="inner"
          size={Size.Xs}
          label={direction === PlayerDirection.Forward ? "Forward" : "Reverse"}
          value={direction === PlayerDirection.Reverse}
          onChange={(v) => setDirection(v ? PlayerDirection.Reverse : PlayerDirection.Forward)}
        >
          <IconArrowNarrowRight
            className={clsx(
              ICON_CLASS_NAME,
              "transition-75 ease-in-out",
              direction === PlayerDirection.Reverse ? "-scale-100" : "scale-100",
            )}
          />
        </ToggleSquare>
        <ToggleSquare
          sizing="inner"
          size={Size.Xs}
          label={looping ? "Looping (on)" : "Looping (off)"}
          value={looping}
          onChange={setLooping}
        >
          <IconRepeat className={ICON_CLASS_NAME} />
        </ToggleSquare>
        <ToggleSquare
          sizing="inner"
          size={Size.Xs}
          label={bounce ? "Bounce (on)" : "Bounce (off)"}
          value={bounce}
          onChange={setBounce}
        >
          <IconArrowBounce className={ICON_CLASS_NAME} />
        </ToggleSquare>
      </div>
      <Select
        label="Select Playback Speed"
        variant={Variant.Default}
        size={Size.Sm}
        options={[
          {
            value: "0.5",
            label: "Slow Playback (0.5x)",
            icon: <IconMultiplier05x className={ICON_CLASS_NAME} />,
          },
          {
            value: "1",
            label: "Normal Playback (1x)",
            icon: <IconMultiplier1x className={ICON_CLASS_NAME} />,
          },
          {
            value: "1.5",
            label: "Fast Playback (1.5x)",
            icon: <IconMultiplier15x className={ICON_CLASS_NAME} />,
          },
          {
            value: "2",
            label: "Very Fast Playback (2x)",
            icon: <IconMultiplier2x className={ICON_CLASS_NAME} />,
          },
        ]}
        value={speed.toString()}
        onChange={(value: string) => {
          const newSpeed = parseFloat(value);
          if (!isNaN(newSpeed)) {
            setSpeed(newSpeed);
          }
        }}
      />
    </div>
  );
}
