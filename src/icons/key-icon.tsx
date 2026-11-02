import { Icon } from "@semio/ui";

export interface KeyIconProps {
  /** Render the dashed keyframe outline. */
  dashed?: boolean;
  /** Glyph in the keyframe center: an add (`plus`) or remove (`minus`) affordance. */
  center?: "plus" | "minus";
  /** Fill opacity of the keyframe body (`0` = hollow/outline). */
  fillOpacity?: number;
  /** Sizing preset; see `<Icon>`. */
  size?: "standard" | "larger" | "none";
  className?: string;
}

/**
 * Typed wrapper over the `key` role. Forwards its (typed) state props through
 * `<Icon name="key">`, so the keyframe glyph stays overrideable via the registry
 * while call sites keep checked props instead of reaching into the loose state
 * bag. The underlying default is `IconKey`, which owns the dashed/center/fill
 * rendering.
 */
export function KeyIcon({ size, className, ...state }: KeyIconProps) {
  return <Icon name="key" size={size} className={className} {...state} />;
}
