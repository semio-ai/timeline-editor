import { memo } from "react";
import { Eye, EyeOff, Speaker, SpeakerOff, Lock, LockOff, ToggleSquare, Size } from "@semio/ui";

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
        label={visible ? "Visible" : "Hidden"}
        value={!visible}
        disabled={disabled || !onToggleVisible}
        onChange={() => onToggleVisible?.()}
      >
        {visible ? (
          <Eye className="block h-4/5 w-4/5 shrink-0" size="100%" />
        ) : (
          <EyeOff className="block h-4/5 w-4/5 shrink-0" size="100%" />
        )}
      </ToggleSquare>

      <ToggleSquare
        sizing="inner"
        size={Size.Xs}
        color={color}
        label={muted ? "Muted" : "Unmuted"}
        value={muted}
        disabled={disabled || !onToggleMuted}
        onChange={() => onToggleMuted?.()}
      >
        {muted ? (
          <SpeakerOff className="block h-4/5 w-4/5 shrink-0" size="100%" />
        ) : (
          <Speaker className="block h-4/5 w-4/5 shrink-0" size="100%" />
        )}
      </ToggleSquare>

      <ToggleSquare
        sizing="inner"
        size={Size.Xs}
        color={color}
        label={locked ? "Locked" : "Unlocked"}
        value={locked}
        disabled={disabled || !onToggleLocked}
        onChange={() => onToggleLocked?.()}
      >
        {locked ? (
          <Lock className="block h-4/5 w-4/5 shrink-0" size="100%" />
        ) : (
          <LockOff className="block h-4/5 w-4/5 shrink-0" size="100%" />
        )}
      </ToggleSquare>
    </>
  );
});
