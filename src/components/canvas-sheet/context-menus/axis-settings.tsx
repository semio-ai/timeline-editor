import { ReactNode } from "react";
import { NestedLabel, NestedRadio, TimeDisplay } from "@semio/ui";

const TIME_DISPLAY_OPTIONS = [
  { value: TimeDisplay.Frames, label: "Frames", closeOnSelect: true },
  { value: TimeDisplay.Seconds, label: "Seconds", closeOnSelect: true },
  { value: TimeDisplay.SecondsPlusFrames, label: "Seconds + Frames", closeOnSelect: true },
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
