import { ReactNode } from "react";
import {
  Icon,
  KeyIcon,
  NestedItem,
  NestedLabel,
  NestedSeparator,
  NestedColorPicker,
  KeybindingHint,
} from "@semio/ui";
import { AnimationAction } from "../../../keybindings";

export interface TrackControlMenuProps {
  /** Whether playback is running (disables most actions). */
  playing: boolean;
  /** Whether all tracks in this row are read-only. */
  allReadonly: boolean;
  /** Track IDs for this row (may be multiple for group rows). */
  trackIds: string[];
  /** Whether this row is a group (affects label phrasing). */
  isGroup?: boolean;
  /** Source row ID for track-scoped actions. */
  sourceRowId: string;

  // --- Track properties ---
  color?: string;
  visible: boolean | "partial";
  muted: boolean;
  locked: boolean | "partial";
  /**
   * Whether the row is read-only by document permission. When true the
   * Lock toggle is disabled (the row already renders as locked) so the
   * user can't appear to clear an enforced permission lock.
   */
  readonly?: boolean;
  onChangeColor?: (color: string) => void;
  onToggleVisible?: () => void;
  onToggleMuted?: () => void;
  onToggleLocked?: () => void;

  /**
   * Remove the track(s) backing this row. Omitted when no active animation
   * is resolvable (so the action would be a no-op).
   */
  onRemoveTrack?: () => void;

  // --- Keyframe actions ---
  /** "none" | "partial" | "full" — whether a key exists at playhead. */
  keyState: "none" | "partial" | "full";
  onAddKeyframe?: () => void;
  onRemoveKeyframe?: () => void;

  // --- Navigation ---
  prevEnabled: boolean;
  nextEnabled: boolean;
  onPrev?: () => void;
  onNext?: () => void;

  // --- Selection ---
  hasSelection: boolean;
  trackKeys?: string[];
  onSelectAllInTrack?: () => void;
  onDeselectAll?: () => void;

  // --- Edit (clipboard) ---
  hasClipboard: boolean;
  onCut?: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
  onDelete?: () => void;
}

/**
 * Shared menu content for track control rows.
 * Used by both the ellipsis Dropdown and the right-click ContextMenu.
 */
export function TrackControlMenuContent({
  playing,
  allReadonly,
  trackIds,
  isGroup = false,
  color,
  visible,
  muted,
  locked,
  readonly = false,
  onChangeColor,
  onToggleVisible,
  onToggleMuted,
  onToggleLocked,
  onRemoveTrack,
  keyState,
  onAddKeyframe,
  onRemoveKeyframe,
  prevEnabled,
  nextEnabled,
  onPrev,
  onNext,
  hasSelection,
  trackKeys,
  onSelectAllInTrack,
  onDeselectAll,
  hasClipboard,
  onCut,
  onCopy,
  onPaste,
  onDelete,
}: TrackControlMenuProps): ReactNode {
  const isSingleTrack = trackIds.length === 1;
  const disabled = playing || allReadonly;

  return (
    <>
      {/* --- Edit --- */}
      <NestedLabel>Edit</NestedLabel>
      <NestedItem
        disabled={!hasSelection}
        onClick={onCut}
        left={<Icon name="cut" />}
        right={<KeybindingHint action={AnimationAction.Cut} />}
      >
        Cut
      </NestedItem>
      <NestedItem
        disabled={!hasSelection}
        onClick={onCopy}
        left={<Icon name="copy" />}
        right={<KeybindingHint action={AnimationAction.Copy} />}
      >
        Copy
      </NestedItem>
      <NestedItem
        disabled={!hasClipboard}
        onClick={onPaste}
        left={<Icon name="paste" />}
        right={<KeybindingHint action={AnimationAction.Paste} />}
      >
        Paste
      </NestedItem>
      <NestedItem
        disabled={!hasSelection}
        onClick={onDelete}
        left={<Icon name="delete" />}
        right={<KeybindingHint action={AnimationAction.Delete} />}
      >
        Delete
      </NestedItem>

      {/* --- Selection --- */}
      <NestedSeparator />
      <NestedLabel>Selection</NestedLabel>
      {trackKeys && onSelectAllInTrack && (
        <NestedItem
          onClick={onSelectAllInTrack}
          left={<Icon name="select-cursor" />}
          right={<KeybindingHint action={AnimationAction.SelectAllInTrack} />}
        >
          {isGroup ? "Select All in Group" : "Select All in Track"}
        </NestedItem>
      )}
      <NestedItem
        disabled={!hasSelection}
        onClick={onDeselectAll}
        left={<Icon name="select-close" />}
        right={<KeybindingHint action={AnimationAction.DeselectAll} />}
      >
        Deselect All
      </NestedItem>

      {/* --- Track Properties --- */}
      <NestedSeparator />
      <NestedLabel>{isGroup ? "Track Group" : "Track"}</NestedLabel>
      {color && (
        <NestedColorPicker
          disabled={!isSingleTrack || playing}
          value={color}
          onChange={(v) => onChangeColor?.(v)}
          label="Change Color"
          left={<Icon name="color-picker" />}
        />
      )}
      <NestedItem
        closeOnSelect={false}
        disabled={playing}
        onClick={onToggleVisible}
        left={visible === true ? <Icon name="eye-off" /> : <Icon name="eye" />}
      >
        {visible === true ? "Hide" : "Show"}
        {isGroup ? " All" : ""}
      </NestedItem>
      <NestedItem
        closeOnSelect={false}
        disabled={disabled}
        onClick={onToggleMuted}
        left={muted ? <Icon name="speaker" /> : <Icon name="speaker-off" />}
      >
        {muted ? "Unmute" : "Mute"}
        {isGroup ? " All" : ""}
      </NestedItem>
      <NestedItem
        closeOnSelect={false}
        disabled={playing || readonly}
        onClick={onToggleLocked}
        left={
          // Document-readonly always reads as locked visually; user-toggle
          // locked uses the same icon. The icon flips to unlock-form only
          // when the user can actually clear it.
          locked === true || readonly ? <Icon name="lock-off" /> : <Icon name="lock" />
        }
      >
        {readonly ? "Locked (document permissions)" : locked === true ? "Unlock" : "Lock"}
        {!readonly && isGroup ? " All" : ""}
      </NestedItem>
      <NestedItem
        disabled={playing || allReadonly || !onRemoveTrack}
        onClick={onRemoveTrack}
        left={<Icon name="delete" />}
      >
        {isGroup ? "Remove Group" : "Remove Track"}
      </NestedItem>

      {/* --- Keys --- */}
      <NestedSeparator />
      <NestedLabel>Keys</NestedLabel>
      <NestedItem
        disabled={playing || allReadonly || keyState === "full"}
        onClick={onAddKeyframe}
        left={<KeyIcon fillOpacity={0} center="plus" size="none" className="size-[18px]" />}
      >
        Add Keyframe
      </NestedItem>
      <NestedItem
        disabled={playing || allReadonly || keyState === "none"}
        onClick={onRemoveKeyframe}
        left={<KeyIcon fillOpacity={0} center="minus" size="none" className="size-[18px]" />}
      >
        Remove Keyframe
      </NestedItem>

      {/* --- Navigate --- */}
      <NestedSeparator />
      <NestedLabel>Navigate</NestedLabel>
      <NestedItem
        disabled={playing || !prevEnabled}
        onClick={onPrev}
        left={<Icon name="playback-skip-back" />}
      >
        Previous Keyframe
      </NestedItem>
      <NestedItem
        disabled={playing || !nextEnabled}
        onClick={onNext}
        left={<Icon name="playback-skip-forward" />}
      >
        Next Keyframe
      </NestedItem>
    </>
  );
}
