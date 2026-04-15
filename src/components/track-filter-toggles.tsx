import { memo } from "react";
import { clsx } from "clsx";
import { useShallow } from "zustand/react/shallow";
import { IconEye, IconVolume, IconLock, IconKey, IconSettings } from "@tabler/icons-react";
import { Tooltip } from "@semio/ui";
import { useAnimationStore } from "../hooks";
import type { AnimationActions, AnimationData } from "../store-types";

/**
 * Filter row toggle buttons:
 * 1. Mode toggle — switches track rows between key/skip and vis/mute/lock
 * 2. Global visibility — toggle visibility for all tracks (placeholder)
 * 3. Global mute — toggle mute for all tracks (placeholder)
 * 4. Global lock — toggle lock for all tracks (placeholder)
 */
export const TrackFilterToggles = memo(function TrackFilterToggles() {
  const controlStripMode = useAnimationStore(
    useShallow((state: AnimationData) => state.preferences.controlStripMode),
  );
  const setPreferences = useAnimationStore(
    useShallow((state: AnimationActions) => state.setPreferences),
  );

  const isProperties = controlStripMode === "properties";

  return (
    <div className="flex shrink-0 items-center gap-0.5">
      {/* Mode toggle */}
      <Tooltip content={isProperties ? "Show key controls" : "Show track properties"} invert>
        <button
          type="button"
          onClick={() =>
            setPreferences({ controlStripMode: isProperties ? "keySkip" : "properties" })
          }
          className={clsx(
            "flex items-center justify-center",
            "size-6 cursor-pointer rounded-xs",
            "transition-colors",
            isProperties
              ? "bg-neutral-500/20 text-neutral-200"
              : "text-neutral-500 hover:bg-neutral-500/10",
          )}
          aria-label="Toggle control strip mode"
        >
          {isProperties ? <IconSettings size={14} /> : <IconKey size={14} />}
        </button>
      </Tooltip>

      {/* Global visibility */}
      <Tooltip content="Toggle all visibility" invert>
        <button
          type="button"
          className="flex size-6 cursor-pointer items-center justify-center rounded-xs text-neutral-500 transition-colors hover:bg-neutral-500/10"
          aria-label="Toggle all track visibility"
        >
          <IconEye size={14} />
        </button>
      </Tooltip>

      {/* Global mute */}
      <Tooltip content="Toggle all mute" invert>
        <button
          type="button"
          className="flex size-6 cursor-pointer items-center justify-center rounded-xs text-neutral-500 transition-colors hover:bg-neutral-500/10"
          aria-label="Toggle all track mute"
        >
          <IconVolume size={14} />
        </button>
      </Tooltip>

      {/* Global lock */}
      <Tooltip content="Toggle all lock" invert>
        <button
          type="button"
          className="flex size-6 cursor-pointer items-center justify-center rounded-xs text-neutral-500 transition-colors hover:bg-neutral-500/10"
          aria-label="Toggle all track lock"
        >
          <IconLock size={14} />
        </button>
      </Tooltip>
    </div>
  );
});
