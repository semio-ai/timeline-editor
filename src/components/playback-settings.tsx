import { clsx } from "clsx";
import {
  ICON_CLASS_NAME,
  Slow,
  Fast,
  Bounce,
  Select,
  Size,
  ToggleSquare,
  Variant,
} from "@semio/ui";
import { PlayerDirection, usePlayerStore } from "@semio/utils";
import { useShallow } from "zustand/shallow";
import { Repeat, ArrowRight, Play, RewindForward } from "@solar-icons/react-perf/LineDuotone";

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
    <div className="flex h-9 flex-1 flex-row items-center gap-1 pl-1">
      <Select
        label="Select Playback Speed"
        variant={Variant.Default}
        size={Size.Sm}
        options={[
          {
            value: "0.5",
            label: "Slow Playback (0.5x)",
            icon: <Slow className={ICON_CLASS_NAME} size="100%" />,
          },
          {
            value: "1",
            label: "Normal Playback (1x)",
            icon: <Play className={ICON_CLASS_NAME} size="100%" />,
          },
          {
            value: "1.5",
            label: "Fast Playback (1.5x)",
            icon: <RewindForward className={ICON_CLASS_NAME} size="100%" />,
          },
          {
            value: "2",
            label: "Very Fast Playback (2x)",
            icon: <Fast className={ICON_CLASS_NAME} size="100%" />,
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

      <div
        className={clsx(
          "grid h-7 min-w-16 grid-cols-3 items-center justify-around gap-1 rounded-xs pr-0.5 pl-1",
        )}
      >
        <ToggleSquare
          sizing="inner"
          size={Size.Xs}
          label={direction === PlayerDirection.Forward ? "Forward" : "Reverse"}
          value={direction === PlayerDirection.Reverse}
          onChange={(v) => setDirection(v ? PlayerDirection.Reverse : PlayerDirection.Forward)}
        >
          <ArrowRight
            size="100%"
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
          <Repeat className="block h-4/5 w-4/5 shrink-0" size="100%" />
        </ToggleSquare>
        <ToggleSquare
          sizing="inner"
          size={Size.Xs}
          label={bounce ? "Bounce (on)" : "Bounce (off)"}
          value={bounce}
          onChange={setBounce}
        >
          <Bounce className={ICON_CLASS_NAME} size="100%" />
        </ToggleSquare>
      </div>
    </div>
  );
}
