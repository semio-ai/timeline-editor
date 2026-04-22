import { ReactNode } from "react";
import {
  Eye,
  EyeOff,
  Speaker,
  SpeakerOff,
  Lock,
  LockOff,
  ICON_CLASS_NAME,
  NestedItem,
  NestedLabel,
  NestedSeparator,
  NestedColorPicker,
  KeybindingHint,
  SelectClose,
  SelectCursor,
  Variant,
  IconKey,
} from "@semio/ui";
import { TrashBinTrash, Copy, Clipboard, Palette2 } from "@solar-icons/react-perf/LineDuotone";
import { Scissors } from "@solar-icons/react-perf/Linear";
import { IconPlayerSkipBack, IconPlayerSkipForward } from "@tabler/icons-react";
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
  onChangeColor?: (color: string) => void;
  onToggleVisible?: () => void;
  onToggleMuted?: () => void;
  onToggleLocked?: () => void;

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
  onChangeColor,
  onToggleVisible,
  onToggleMuted,
  onToggleLocked,
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
      {/* --- Track Properties --- */}
      <NestedLabel>Track</NestedLabel>
      {color && (
        <NestedColorPicker
          disabled={!isSingleTrack || playing}
          value={color}
          onChange={(v) => onChangeColor?.(v)}
          left={<Palette2 size="18px" className={ICON_CLASS_NAME} />}
        />
      )}
      <NestedItem
        closeOnSelect={false}
        disabled={playing}
        onClick={onToggleVisible}
        left={
          visible === true ? (
            <EyeOff size="18px" className={ICON_CLASS_NAME} />
          ) : (
            <Eye size="18px" className={ICON_CLASS_NAME} />
          )
        }
      >
        {visible === true ? "Hide" : "Show"}{isGroup ? " All" : ""}
      </NestedItem>
      <NestedItem
        closeOnSelect={false}
        disabled={disabled}
        onClick={onToggleMuted}
        left={
          muted ? (
            <Speaker size="18px" className={ICON_CLASS_NAME} />
          ) : (
            <SpeakerOff size="18px" className={ICON_CLASS_NAME} />
          )
        }
      >
        {muted ? "Unmute" : "Mute"}{isGroup ? " All" : ""}
      </NestedItem>
      <NestedItem
        closeOnSelect={false}
        disabled={playing}
        onClick={onToggleLocked}
        left={
          locked === true ? (
            <LockOff size="18px" className={ICON_CLASS_NAME} />
          ) : (
            <Lock size="18px" className={ICON_CLASS_NAME} />
          )
        }
      >
        {locked === true ? "Unlock" : "Lock"}{isGroup ? " All" : ""}
      </NestedItem>

      {/* --- Keys --- */}
      <NestedSeparator />
      <NestedLabel>Keys</NestedLabel>
      <NestedItem
        disabled={playing || allReadonly || keyState === "full"}
        onClick={onAddKeyframe}
        left={<IconKey fillOpacity={0} center="plus" size="18px" className={ICON_CLASS_NAME} />}
      >
        Add Keyframe
      </NestedItem>
      <NestedItem
        disabled={playing || allReadonly || keyState === "none"}
        onClick={onRemoveKeyframe}
        left={<IconKey fillOpacity={0} center="minus" size="18px" className={ICON_CLASS_NAME} />}
      >
        Remove Keyframe
      </NestedItem>

      {/* --- Navigate --- */}
      <NestedSeparator />
      <NestedLabel>Navigate</NestedLabel>
      <NestedItem
        disabled={playing || !prevEnabled}
        onClick={onPrev}
        left={<IconPlayerSkipBack size="18px" className={ICON_CLASS_NAME} />}
      >
        Previous Keyframe
      </NestedItem>
      <NestedItem
        disabled={playing || !nextEnabled}
        onClick={onNext}
        left={<IconPlayerSkipForward size="18px" className={ICON_CLASS_NAME} />}
      >
        Next Keyframe
      </NestedItem>

      {/* --- Selection --- */}
      <NestedSeparator />
      <NestedLabel>Selection</NestedLabel>
      {trackKeys && onSelectAllInTrack && (
        <NestedItem
          onClick={onSelectAllInTrack}
          left={<SelectCursor size="18px" className={ICON_CLASS_NAME} />}
          right={<KeybindingHint action={AnimationAction.SelectAllInTrack} />}
        >
          {isGroup ? "Select All in Group" : "Select All in Track"}
        </NestedItem>
      )}
      <NestedItem
        disabled={!hasSelection}
        onClick={onDeselectAll}
        left={<SelectClose size="18px" className={ICON_CLASS_NAME} />}
        right={<KeybindingHint action={AnimationAction.DeselectAll} />}
      >
        Deselect All
      </NestedItem>

      {/* --- Edit --- */}
      <NestedSeparator />
      <NestedLabel>Edit</NestedLabel>
      <NestedItem
        disabled={!hasSelection}
        onClick={onCut}
        left={<Scissors size="18px" className={ICON_CLASS_NAME} />}
        right={<KeybindingHint action={AnimationAction.Cut} />}
      >
        Cut
      </NestedItem>
      <NestedItem
        disabled={!hasSelection}
        onClick={onCopy}
        left={<Copy size="18px" className={ICON_CLASS_NAME} />}
        right={<KeybindingHint action={AnimationAction.Copy} />}
      >
        Copy
      </NestedItem>
      <NestedItem
        disabled={!hasClipboard}
        onClick={onPaste}
        left={<Clipboard size="18px" className={ICON_CLASS_NAME} />}
        right={<KeybindingHint action={AnimationAction.Paste} />}
      >
        Paste
      </NestedItem>
      <NestedItem
        disabled={!hasSelection}
        onClick={onDelete}
        left={<TrashBinTrash size="18px" className={ICON_CLASS_NAME} />}
        right={<KeybindingHint action={AnimationAction.Delete} />}
      >
        Delete
      </NestedItem>
    </>
  );
}
