import { memo } from "react";
import {
  ICON_CLASS_NAME,
  Eye,
  EyeOff,
  Speaker,
  SpeakerOff,
  Lock,
  LockOff,
  ToggleSquare,
  Size,
} from "@semio/ui";

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
        {visible
          ? <Eye className={ICON_CLASS_NAME} size="100%" />
          : <EyeOff className={ICON_CLASS_NAME} size="100%" />}
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
        {muted
          ? <SpeakerOff className={ICON_CLASS_NAME} size="100%" />
          : <Speaker className={ICON_CLASS_NAME} size="100%" />}
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
        {locked
          ? <Lock className={ICON_CLASS_NAME} size="100%" />
          : <LockOff className={ICON_CLASS_NAME} size="100%" />}
      </ToggleSquare>
    </>
  );
});
