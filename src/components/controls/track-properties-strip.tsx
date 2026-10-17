import { memo } from "react";
import { Icon, ToggleSquare, Size } from "@semio/ui";

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
          <Icon name="state-hidden" size="none" className="block w-3.5 h-3.5 shrink-0" />
        ) : (
          <Icon name="state-visible" size="none" className="block w-3.5 h-3.5 shrink-0" />
        )}
      </ToggleSquare>

      <ToggleSquare
        sizing="inner"
        size={Size.Xs}
        color={color}
        label={`${muted === true ? "Unmute" : "Mute"}${suffix}`}
        value={muted === "partial" ? "partial" : !muted}
        disabled={disabled || !onToggleMuted}
        onChange={() => onToggleMuted?.()}
      >
        {muted === true ? (
          <Icon name="state-muted" size="none" className="block w-3.5 h-3.5 shrink-0" />
        ) : (
          <Icon name="state-unmuted" size="none" className="block w-3.5 h-3.5 shrink-0" />
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
          <Icon name="state-locked" size="none" className="block w-3.5 h-3.5 shrink-0" />
        ) : (
          <Icon name="state-unlocked" size="none" className="block w-3.5 h-3.5 shrink-0" />
        )}
      </ToggleSquare>
    </>
  );
});
