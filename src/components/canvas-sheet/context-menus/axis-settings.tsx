import { ReactNode } from "react";
import { Icon, NestedLabel, NestedRadio, TimeDisplay } from "@semio/ui";

// No `closeOnSelect`: a radio group closes on pick by default, which is what
// these all set explicitly back when the default was the opposite.
const TIME_DISPLAY_OPTIONS = [
  { value: TimeDisplay.Frames, label: "Frames", icon: <Icon name="time-display-frames" /> },
  { value: TimeDisplay.Seconds, label: "Seconds", icon: <Icon name="time-display-seconds" /> },
  {
    value: TimeDisplay.SecondsPlusFrames,
    label: "Seconds + Frames",
    icon: <Icon name="time-display-seconds-frames" />,
  },
];

/**
 * "Axis Settings" radio section for ruler context menu.
 * Allows switching between Frames, Seconds, and Seconds+Frames display.
 */
export function AxisSettingsSection({
  timeDisplay,
  setTimeDisplay,
}: {
  timeDisplay: TimeDisplay;
  setTimeDisplay: (v: TimeDisplay) => void;
}): ReactNode {
  return (
    <>
      <NestedLabel>Axis Settings</NestedLabel>
      <NestedRadio
        value={timeDisplay}
        onChange={(v) => setTimeDisplay(v as TimeDisplay)}
        options={TIME_DISPLAY_OPTIONS}
      />
    </>
  );
}
