import type { IconName } from "@semio/ui";

/**
 * The playback speeds the player offers, slowest first. The value is the string
 * form of the multiplier the player store holds, so the select can match it with
 * `speed.toString()`; each speed has its own glyph showing that multiplier.
 */
export const PLAYBACK_SPEED_OPTIONS: readonly {
  value: string;
  label: string;
  icon: IconName;
}[] = [
  { value: "0.1", label: "Very Slow Playback (0.1x)", icon: "playback-0.1" },
  { value: "0.5", label: "Slow Playback (0.5x)", icon: "playback-0.5" },
  { value: "1", label: "Normal Playback (1x)", icon: "playback-1.0" },
  { value: "1.5", label: "Fast Playback (1.5x)", icon: "playback-1.5" },
  { value: "2", label: "Very Fast Playback (2x)", icon: "playback-2.0" },
];
