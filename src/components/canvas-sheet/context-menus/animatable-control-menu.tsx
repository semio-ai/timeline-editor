import { ReactNode } from "react";
import {
  ICON_CLASS_NAME,
  NestedItem,
  NestedLabel,
  NestedSeparator,
  NestedColorPicker,
} from "@semio/ui";
import { Palette2 } from "@solar-icons/react-perf/LineDuotone";
import { IconPlus } from "@tabler/icons-react";

export interface AnimatableLeafMenuProps {
  color: string;
  disabled: boolean;
  onChangeColor: (color: string) => void;
  /** Available when the animatable can be added to the active animation. */
  onAddTrack?: () => void;
}

/**
 * Menu content for animatable leaf controls in direct/track-missing mode.
 * Used by both the ellipsis Dropdown and the right-click ContextMenu.
 */
export function AnimatableLeafMenuContent({
  color,
  disabled,
  onChangeColor,
  onAddTrack,
}: AnimatableLeafMenuProps): ReactNode {
  return (
    <>
      <NestedLabel>Animatable</NestedLabel>
      <NestedColorPicker
        disabled={disabled}
        value={color}
        onChange={onChangeColor}
        label="Change Color"
        left={<Palette2 size="18px" className={ICON_CLASS_NAME} />}
      />
      {onAddTrack && (
        <>
          <NestedSeparator />
          <NestedLabel>Track</NestedLabel>
          <NestedItem
            disabled={disabled}
            onClick={onAddTrack}
            left={<IconPlus size="18px" className={ICON_CLASS_NAME} />}
          >
            Add Track
          </NestedItem>
        </>
      )}
    </>
  );
}

export interface AnimatableGroupMenuProps {
  disabled: boolean;
  /** Available when missing child tracks can be added to the active animation. */
  onAddTracks?: () => void;
}

/**
 * Menu content for animatable group controls that don't have tracks yet.
 * Groups WITH tracks delegate to TrackControlMenuContent instead.
 */
export function AnimatableGroupMenuContent({
  disabled,
  onAddTracks,
}: AnimatableGroupMenuProps): ReactNode {
  return (
    <>
      <NestedLabel>Group</NestedLabel>
      <NestedItem
        disabled={disabled || !onAddTracks}
        onClick={onAddTracks}
        left={<IconPlus size="18px" className={ICON_CLASS_NAME} />}
      >
        Add All Tracks
      </NestedItem>
    </>
  );
}
