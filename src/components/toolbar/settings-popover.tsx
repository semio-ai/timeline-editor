import { memo } from "react";
import { Popover, Select, Size, type SelectOption } from "@semio/ui";
import { useShallow } from "zustand/shallow";
import { useAnimationStore } from "../../hooks";
import {
  ControlStripMode,
  HandleVisibility,
  ViolationVisibility,
} from "../../store-types";
import type { AnimationData, AnimationActions } from "../../store-types";
import { ToolbarTooltipButton } from "./toolbar-tooltip-button";

const HANDLE_VISIBILITY_OPTIONS: SelectOption[] = [
  { value: HandleVisibility.TrackSelection, label: "Track selection" },
  { value: HandleVisibility.SingleTrack, label: "Single track" },
  { value: HandleVisibility.KeySelection, label: "Key selection" },
];

const HANDLE_VISIBILITY_DESCRIPTIONS: Record<HandleVisibility, string> = {
  [HandleVisibility.TrackSelection]:
    "Handles appear on all keys in any track that has selected keypoints.",
  [HandleVisibility.SingleTrack]: "Handles appear only when a single track is selected.",
  [HandleVisibility.KeySelection]: "Handles appear only on individually selected keypoints.",
};

const CONTROL_STRIP_OPTIONS: SelectOption[] = [
  { value: ControlStripMode.KeySkip, label: "Key controls" },
  { value: ControlStripMode.Properties, label: "Track properties" },
];

const CONTROL_STRIP_DESCRIPTIONS: Record<ControlStripMode, string> = {
  [ControlStripMode.KeySkip]: "Track rows show keyframe navigation and add/remove controls.",
  [ControlStripMode.Properties]: "Track rows show visibility, mute, and lock toggles.",
};

const VIOLATION_VISIBILITY_OPTIONS: SelectOption[] = [
  { value: ViolationVisibility.Visible, label: "Show all" },
  { value: ViolationVisibility.Selection, label: "Selected tracks only" },
  { value: ViolationVisibility.Hidden, label: "Hide all" },
];

const VIOLATION_VISIBILITY_DESCRIPTIONS: Record<ViolationVisibility, string> = {
  [ViolationVisibility.Visible]: "Violations are shown on every track.",
  [ViolationVisibility.Selection]:
    "Violations are shown only on tracks with selected keypoints.",
  [ViolationVisibility.Hidden]: "Violations are hidden from view.",
};

/**
 * Settings popover for animation editor preferences.
 * Placed in the toolbar next to the fit-to-content button.
 */
export const SettingsPopover = memo(function SettingsPopover() {
  const handleVisibility = useAnimationStore(
    useShallow(
      (state: AnimationData) =>
        state.preferences.handleVisibility ?? HandleVisibility.TrackSelection,
    ),
  );
  const controlStripMode = useAnimationStore(
    useShallow((state: AnimationData) => state.preferences.controlStripMode),
  );
  const violationVisibility = useAnimationStore(
    useShallow(
      (state: AnimationData) =>
        state.preferences.violationVisibility ?? ViolationVisibility.Visible,
    ),
  );
  const setPreferences = useAnimationStore(
    useShallow((state: AnimationActions) => state.setPreferences),
  );

  return (
    <Popover
      trigger={
        <ToolbarTooltipButton
          tooltip="Editor settings"
          visuals="inverted"
          size={Size.Sm}
          leftIcon="settings"
          className="rounded-xs bg-neutral-500/10 hover:bg-neutral-500/25"
        />
      }
    >
      <div className="flex flex-col gap-3 p-2.5" style={{ width: 260 }}>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Editor Settings
        </h3>

        {/* Handle Visibility */}
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-neutral-800 dark:text-neutral-200">Handle Visibility</span>
          <Select
            size={Size.Sm}
            value={handleVisibility}
            options={HANDLE_VISIBILITY_OPTIONS}
            onChange={(v) => setPreferences({ handleVisibility: v as HandleVisibility })}
          />
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {HANDLE_VISIBILITY_DESCRIPTIONS[handleVisibility]}
          </p>
        </div>

        {/* Violation Visibility */}
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-neutral-800 dark:text-neutral-200">Violation Visibility</span>
          <Select
            size={Size.Sm}
            value={violationVisibility}
            options={VIOLATION_VISIBILITY_OPTIONS}
            onChange={(v) => setPreferences({ violationVisibility: v as ViolationVisibility })}
          />
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {VIOLATION_VISIBILITY_DESCRIPTIONS[violationVisibility]}
          </p>
        </div>

        {/* Control Strip Mode */}
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-neutral-800 dark:text-neutral-200">Track Controls</span>
          <Select
            size={Size.Sm}
            value={controlStripMode}
            options={CONTROL_STRIP_OPTIONS}
            onChange={(v) => setPreferences({ controlStripMode: v as ControlStripMode })}
          />
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {CONTROL_STRIP_DESCRIPTIONS[controlStripMode]}
          </p>
        </div>
      </div>
    </Popover>
  );
});
