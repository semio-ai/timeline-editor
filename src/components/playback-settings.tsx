import { clsx } from "clsx";
import { Icon, Select, Size, ToggleSquare, Variant } from "@semio/ui";
import { PlayerDirection } from "@semio/utils";
import { useShallow } from "zustand/shallow";
import { usePlayer } from "../hooks/use-player";
import { PLAYBACK_SPEED_OPTIONS } from "./playback-speed-options";

export function PlaybackSettings() {
  const { direction, bounce, looping, speed } = usePlayer(
    useShallow((state) => ({
      direction: state.player.direction,
      bounce: state.player.bounce,
      looping: state.player.looping,
      speed: state.player.speed,
    })),
  );

  // Map bounce/looping combination to style for UI compatibility
  const { setBounce, setLooping, setDirection, setSpeed } = usePlayer(
    useShallow((state) => ({
      setBounce: state.updateBounce,
      setLooping: state.updateLooping,
      setDirection: state.updateDirection,
      setSpeed: state.updateSpeed,
    })),
  );

  return (
    <>
      <Select
        label="Select Playback Speed"
        variant={Variant.Default}
        size={Size.Sm}
        options={[...PLAYBACK_SPEED_OPTIONS]}
        value={speed.toString()}
        onChange={(value: string) => {
          const newSpeed = parseFloat(value);
          if (!isNaN(newSpeed)) {
            setSpeed(newSpeed);
          }
        }}
      />
      <ToggleSquare
        sizing="inner"
        size={Size.Xs}
        label={direction === PlayerDirection.Forward ? "Forward" : "Reverse"}
        value={direction === PlayerDirection.Reverse}
        onChange={(v) => setDirection(v ? PlayerDirection.Reverse : PlayerDirection.Forward)}
      >
        <Icon
          name="playback-direction"
          size="none"
          className={clsx(
            "block w-3.5 h-3.5 shrink-0",
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
        <Icon name="playback-loop" size="none" className="block w-3.5 h-3.5 shrink-0" />
      </ToggleSquare>
      <ToggleSquare
        sizing="inner"
        size={Size.Xs}
        label={bounce ? "Bounce (on)" : "Bounce (off)"}
        value={bounce}
        onChange={setBounce}
      >
        <Icon name="playback-bounce" size="none" className="block w-3.5 h-3.5 shrink-0" />
      </ToggleSquare>
    </>
  );
}
