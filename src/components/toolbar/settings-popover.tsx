import { memo } from "react";
import { Popover, Select, Size, type SelectOption } from "@semio/ui";
import { IconSettings } from "@tabler/icons-react";
import { useShallow } from "zustand/shallow";
import { useAnimationStore } from "../../hooks";
import type { AnimationData, AnimationActions, HandleVisibility } from "../../store-types";
import { ToolbarTooltipButton } from "./toolbar-tooltip-button";

const HANDLE_VISIBILITY_OPTIONS: SelectOption[] = [
  { value: "track-selection", label: "Track selection" },
  { value: "single-track", label: "Single track" },
  { value: "key-selection", label: "Key selection" },
];

const HANDLE_VISIBILITY_DESCRIPTIONS: Record<HandleVisibility, string> = {
  "track-selection": "Handles appear on all keys in any track that has selected keypoints.",
  "single-track": "Handles appear only when a single track is selected.",
  "key-selection": "Handles appear only on individually selected keypoints.",
};

const CONTROL_STRIP_OPTIONS: SelectOption[] = [
  { value: "keySkip", label: "Key controls" },
  { value: "properties", label: "Track properties" },
];

const CONTROL_STRIP_DESCRIPTIONS: Record<string, string> = {
  keySkip: "Track rows show keyframe navigation and add/remove controls.",
  properties: "Track rows show visibility, mute, and lock toggles.",
};

/**
 * Settings popover for animation editor preferences.
 * Placed in the toolbar next to the fit-to-content button.
 */
export const SettingsPopover = memo(function SettingsPopover() {
  const handleVisibility = useAnimationStore(
    useShallow((state: AnimationData) => state.preferences.handleVisibility ?? "track-selection"),
  );
  const controlStripMode = useAnimationStore(
    useShallow((state: AnimationData) => state.preferences.controlStripMode),
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
          leftIcon={<IconSettings size={16} />}
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
          <label className="text-xs font-medium text-neutral-800 dark:text-neutral-200">Handle Visibility</label>
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

        {/* Control Strip Mode */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-neutral-800 dark:text-neutral-200">Track Controls</label>
          <Select
            size={Size.Sm}
            value={controlStripMode}
            options={CONTROL_STRIP_OPTIONS}
            onChange={(v) =>
              setPreferences({ controlStripMode: v as "keySkip" | "properties" })
            }
          />
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {CONTROL_STRIP_DESCRIPTIONS[controlStripMode]}
          </p>
        </div>
      </div>
    </Popover>
  );
});
