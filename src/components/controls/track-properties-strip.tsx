import { memo } from "react";
import { Eye, EyeOff, Speaker, SpeakerOff, Lock, LockOff, ToggleSquare, Size } from "@semio/ui";

export interface TrackPropertiesStripProps {
  color?: string;
  disabled?: boolean;
  /** Whether this row is a group (affects tooltip phrasing). */
  isGroup?: boolean;
  /** true = all visible, false = all hidden, "partial" = mixed */
  visible?: boolean | "partial";
  /** true = all muted, false = all unmuted, "partial" = mixed */
  muted?: boolean | "partial";
  /** true = all locked, false = all unlocked, "partial" = mixed */
  locked?: boolean | "partial";
  /**
   * true when every track in the row is read-only by document permission.
   * Renders the lock toggle as locked (regardless of `locked`) and disables
   * it so the user can't appear to clear an enforced permission lock.
   */
  readonly?: boolean;
  onToggleVisible?: () => void;
  onToggleMuted?: () => void;
  onToggleLocked?: () => void;
}

/**
 * Visibility / Mute / Lock toggle strip for track rows.
 * Shown when controlStripMode is ControlStripMode.Properties.
 * Uses ToggleSquare for consistent toggle button styling.
 */
export const TrackPropertiesStrip = memo(function TrackPropertiesStrip({
  color,
  disabled = false,
  isGroup = false,
  visible = true,
  muted = false,
  locked = false,
  readonly = false,
  onToggleVisible,
  onToggleMuted,
  onToggleLocked,
}: TrackPropertiesStripProps) {
  const suffix = isGroup ? " All" : "";
  return (
    <>
      <ToggleSquare
        sizing="inner"
        size={Size.Xs}
        color={color}
        label={`${visible === true ? "Hide" : "Show"}${suffix}`}
        value={visible === "partial" ? "partial" : visible}
        disabled={disabled || !onToggleVisible}
        onChange={() => onToggleVisible?.()}
      >
        {visible === false ? (
          <EyeOff className="block w-3.5 h-3.5 shrink-0" size="100%" />
        ) : (
          <Eye className="block w-3.5 h-3.5 shrink-0" size="100%" />
        )}
      </ToggleSquare>

      <ToggleSquare
        sizing="inner"
        size={Size.Xs}
        color={color}
        label={`${muted ? "Unmute" : "Mute"}${suffix}`}
        value={muted === "partial" ? "partial" : !muted}
        disabled={disabled || !onToggleMuted}
        onChange={() => onToggleMuted?.()}
      >
        {muted === true ? (
          <SpeakerOff className="block w-3.5 h-3.5 shrink-0" size="100%" />
        ) : (
          <Speaker className="block w-3.5 h-3.5 shrink-0" size="100%" />
        )}
      </ToggleSquare>

      <ToggleSquare
        sizing="inner"
        size={Size.Xs}
        color={color}
        label={
          readonly
            ? "Locked (document permissions)"
            : `${locked === true ? "Unlock" : "Lock"}${suffix}`
        }
        // `value` semantics: `false` renders as "off" (unlocked toggle).
        // Readonly forces "on" so the lock icon shows even when no user
        // lock is set; partial collapses to "partial" only when user locks
        // are mixed and there's no readonly enforcement.
        value={readonly ? false : locked === "partial" ? "partial" : !locked}
        disabled={disabled || readonly || !onToggleLocked}
        onChange={() => onToggleLocked?.()}
      >
        {locked === true || readonly ? (
          <Lock className="block w-3.5 h-3.5 shrink-0" size="100%" />
        ) : (
          <LockOff className="block w-3.5 h-3.5 shrink-0" size="100%" />
        )}
      </ToggleSquare>
    </>
  );
});
