import { memo } from "react";
import { Eye, EyeOff, Speaker, SpeakerOff, Lock, LockOff, ToggleSquare, Size } from "@semio/ui";

export interface TrackPropertiesStripProps {
  color?: string;
  disabled?: boolean;
  /** true = all visible, false = all hidden, "partial" = mixed */
  visible?: boolean | "partial";
  /** true = all muted, false = all unmuted, "partial" = mixed */
  muted?: boolean | "partial";
  /** true = all locked, false = all unlocked, "partial" = mixed */
  locked?: boolean | "partial";
  onToggleVisible?: () => void;
  onToggleMuted?: () => void;
  onToggleLocked?: () => void;
}

/**
 * Visibility / Mute / Lock toggle strip for track rows.
 * Shown when controlStripMode is "properties".
 * Uses ToggleSquare for consistent toggle button styling.
 */
export const TrackPropertiesStrip = memo(function TrackPropertiesStrip({
  color,
  disabled = false,
  visible = true,
  muted = false,
  locked = false,
  onToggleVisible,
  onToggleMuted,
  onToggleLocked,
}: TrackPropertiesStripProps) {
  return (
    <>
      <ToggleSquare
        sizing="inner"
        size={Size.Xs}
        color={color}
        label={visible === true ? "Visible" : visible === false ? "Hidden" : "Partially visible"}
        value={visible === "partial" ? "partial" : !visible}
        disabled={disabled || !onToggleVisible}
        onChange={() => onToggleVisible?.()}
      >
        {visible === false ? (
          <EyeOff className="block h-4/5 w-4/5 shrink-0" size="100%" />
        ) : (
          <Eye className="block h-4/5 w-4/5 shrink-0" size="100%" />
        )}
      </ToggleSquare>

      <ToggleSquare
        sizing="inner"
        size={Size.Xs}
        color={color}
        label={muted === true ? "Muted" : muted === false ? "Unmuted" : "Partially muted"}
        value={muted === "partial" ? "partial" : (muted ?? false)}
        disabled={disabled || !onToggleMuted}
        onChange={() => onToggleMuted?.()}
      >
        {muted === true ? (
          <SpeakerOff className="block h-4/5 w-4/5 shrink-0" size="100%" />
        ) : (
          <Speaker className="block h-4/5 w-4/5 shrink-0" size="100%" />
        )}
      </ToggleSquare>

      <ToggleSquare
        sizing="inner"
        size={Size.Xs}
        color={color}
        label={locked === true ? "Locked" : locked === false ? "Unlocked" : "Partially locked"}
        value={locked === "partial" ? "partial" : (locked ?? false)}
        disabled={disabled || !onToggleLocked}
        onChange={() => onToggleLocked?.()}
      >
        {locked === true ? (
          <Lock className="block h-4/5 w-4/5 shrink-0" size="100%" />
        ) : (
          <LockOff className="block h-4/5 w-4/5 shrink-0" size="100%" />
        )}
      </ToggleSquare>
    </>
  );
});
