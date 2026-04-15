import { memo } from "react";
import { clsx } from "clsx";
import { IconEye, IconEyeOff, IconVolume, IconVolumeOff, IconLock, IconLockOpen } from "@tabler/icons-react";

export interface TrackPropertiesStripProps {
  color?: string;
  disabled?: boolean;
  visible?: boolean;
  muted?: boolean;
  locked?: boolean;
  onToggleVisible?: () => void;
  onToggleMuted?: () => void;
  onToggleLocked?: () => void;
}

/**
 * Visibility / Mute / Lock toggle strip for track rows.
 * Shown when controlStripMode is "properties".
 * Each button toggles one property; icons change to reflect state.
 */
export const TrackPropertiesStrip = memo(function TrackPropertiesStrip({
  color = "#737373",
  disabled = false,
  visible = true,
  muted = false,
  locked = false,
  onToggleVisible,
  onToggleMuted,
  onToggleLocked,
}: TrackPropertiesStripProps) {
  return (
    <div className="grid h-7 w-16 grid-cols-3 items-center justify-between">
      <button
        type="button"
        disabled={disabled || !onToggleVisible}
        onClick={onToggleVisible}
        className={clsx(
          "flex items-center justify-center",
          "size-5 cursor-pointer rounded-xs",
          "transition-colors hover:bg-neutral-500/20",
          (disabled || !onToggleVisible) && "pointer-events-none opacity-40",
          !visible && "opacity-50",
        )}
        style={{ color }}
        aria-label={visible ? "Hide track" : "Show track"}
      >
        {visible ? <IconEye size={14} /> : <IconEyeOff size={14} />}
      </button>

      <button
        type="button"
        disabled={disabled || !onToggleMuted}
        onClick={onToggleMuted}
        className={clsx(
          "flex items-center justify-center",
          "size-5 cursor-pointer rounded-xs",
          "transition-colors hover:bg-neutral-500/20",
          (disabled || !onToggleMuted) && "pointer-events-none opacity-40",
          muted && "opacity-50",
        )}
        style={{ color }}
        aria-label={muted ? "Unmute track" : "Mute track"}
      >
        {muted ? <IconVolumeOff size={14} /> : <IconVolume size={14} />}
      </button>

      <button
        type="button"
        disabled={disabled || !onToggleLocked}
        onClick={onToggleLocked}
        className={clsx(
          "flex items-center justify-center",
          "size-5 cursor-pointer rounded-xs",
          "transition-colors hover:bg-neutral-500/20",
          (disabled || !onToggleLocked) && "pointer-events-none opacity-40",
          locked && "opacity-50",
        )}
        style={{ color }}
        aria-label={locked ? "Unlock track" : "Lock track"}
      >
        {locked ? <IconLock size={14} /> : <IconLockOpen size={14} />}
      </button>
    </div>
  );
});
