import { clsx } from "clsx";
import { Select, Size, ToggleSquare, Variant } from "@semio/ui";
import { usePlayerStore } from "@semio/utils";
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
  console.log({ direction, bounce, looping, speed });

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
          label={direction === "forward" ? "Forward" : "Reverse"}
          value={direction === "reverse"}
          onChange={(v) => setDirection(v ? "reverse" : "forward")}
        >
          <IconArrowNarrowRight
            className={clsx(
              "h-3/5 aspect-square transition-75 ease-in-out",
              direction === "reverse" ? "-scale-100" : "scale-100",
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
          <IconRepeat className="h-3/5 aspect-square" />
        </ToggleSquare>
        <ToggleSquare
          sizing="inner"
          size={Size.Xs}
          label={bounce ? "Bounce (on)" : "Bounce (off)"}
          value={bounce}
          onChange={setBounce}
        >
          <IconArrowBounce className="h-3/5 aspect-square" />
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
            icon: <IconMultiplier05x size="14px" />,
          },
          {
            value: "1",
            label: "Normal Playback (1x)",
            icon: <IconMultiplier1x size="14px" />,
          },
          {
            value: "1.5",
            label: "Fast Playback (1.5x)",
            icon: <IconMultiplier15x size="14px" />,
          },
          {
            value: "2",
            label: "Very Fast Playback (2x)",
            icon: <IconMultiplier2x size="14px" />,
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
