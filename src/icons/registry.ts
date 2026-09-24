import {
  defaultIconRegistry,
  PlayerEndBounds,
  IconTimeDisplaySeconds,
  createSolarIcon as solar,
} from "@semio/ui";
import { Pen, Settings as SolarSettings } from "@solar-icons/react-perf/LineDuotone";
import { MenuDots } from "@solar-icons/react-perf/Bold";
import { Text } from "@solar-icons/react-perf/Linear";
import { Hashtag, DangerTriangle, ClockCircle } from "@solar-icons/react-perf/LineDuotone";
import { IconRotate3d, IconPercent } from "@semio/ui";
import { type IconRegistry } from "@semio/ui";
import { Angle, IconFolderClosed } from "@semio/ui";
import { Play, Pause, SkipPrevious, SkipNext } from "@solar-icons/react-perf/Bold";
import {
  TrashBinTrash,
  Clipboard,
  Ruler,
  Repeat,
  ArrowRight,
  Palette2,
} from "@solar-icons/react-perf/LineDuotone";
import { Scissors, AlignHorizontalCenter, Bolt } from "@solar-icons/react-perf/Linear";
import { MovePlayerStartBounds, PlaybackSeekStartBounds } from "./boundary-glyphs";

/**
 * Animation owns editor actions, playback, data-type aliases, and units. UI glyph
 * keys are inherited. Studio inherits these decisions without redeclaring them.
 * Consumer IconProviders remain free to provide intentional theme overrides.
 *
 * Deprecated keys stay registered so a consumer that names them keeps rendering
 * the same meaning. `speed-slow`, `speed-normal`, `speed-fast` and `speed-fastest`
 * resolve to the multiplier glyphs `playback-0.5`, `playback-1.0`, `playback-1.5`
 * and `playback-2.0`, which are the keys to use; an override of a deprecated key
 * does not reach the playback-speed select, which names the new keys.
 */
// `satisfies` (not `: IconRegistry`) keeps the literal keys for `keyof` below.
export const animationIconRegistry = {
  delete: solar(TrashBinTrash),
  paste: solar(Clipboard),
  cut: solar(Scissors),
  settings: solar(SolarSettings, "icon-duotone-inverted"),
  edit: solar(Pen),
  menu: solar(MenuDots, "rotate-90"),
  "playback-play": solar(Play),
  "playback-pause": solar(Pause),
  "playback-skip-back": solar(SkipPrevious),
  "playback-skip-forward": solar(SkipNext),
  "playback-loop": solar(Repeat),
  "playback-direction": solar(ArrowRight),
  "data-euler": IconRotate3d,
  "data-rgb": solar(Palette2),
  "data-hsl": solar(Palette2),
  "data-group": IconFolderClosed,
  "data-number": solar(Hashtag),
  "data-text": solar(Text),
  "data-none": solar(Hashtag),
  "unit-radian": Angle,
  "unit-degree": Angle,
  "unit-meter": solar(Ruler),
  "unit-millimeter": solar(Ruler),
  "unit-centimeter": solar(Ruler),
  "unit-kilometer": solar(Ruler),
  "unit-percent": IconPercent,
  "transition-snap": solar(Bolt),
  "align-keys": solar(AlignHorizontalCenter),
  "color-picker": solar(Palette2),
  alert: solar(DangerTriangle),
  /** @deprecated Use time-display or sort-created for the respective control. */
  clock: solar(ClockCircle),
  "workspace-toggle": defaultIconRegistry["chevron-down"],
  rename: solar(Pen),
  "menu-edit": solar(Pen),
  "menu-view": defaultIconRegistry["preview-open"],
  "time-display": IconTimeDisplaySeconds,
  "playback-bounce": defaultIconRegistry.bounce,
  "view-keys": defaultIconRegistry["vector-flat"],
  "view-transitions": defaultIconRegistry["vector-angled"],
  "view-preview": defaultIconRegistry["vector-bezier"],
  "view-spline": defaultIconRegistry["vector-bezier-handles"],
  "view-data": defaultIconRegistry["graph-view"],
  "transition-bezier-handles": defaultIconRegistry["vector-bezier-handles"],
  "transition-auto-clamped": defaultIconRegistry["vector-bezier-auto-clamp"],
  "move-player-start-bounds": MovePlayerStartBounds,
  "playback-seek-start-bounds": PlaybackSeekStartBounds,
  "playback-seek-end-bounds": PlayerEndBounds,
  "transition-back": defaultIconRegistry["vector-back"],
  "transition-circular": defaultIconRegistry["vector-circ"],
  "transition-cubic": defaultIconRegistry["vector-cubic"],
  "transition-exponential": defaultIconRegistry["vector-expo"],
  "transition-linear": defaultIconRegistry["vector-linear"],
  "transition-quadratic": defaultIconRegistry["vector-quad"],
  "transition-quartic": defaultIconRegistry["vector-quart"],
  "transition-quintic": defaultIconRegistry["vector-quint"],
  "transition-sine": defaultIconRegistry["vector-sine"],
  /** @deprecated Use `playback-0.5`. */
  "speed-slow": defaultIconRegistry["playback-0.5"],
  /** @deprecated Use `playback-1.0`. */
  "speed-normal": defaultIconRegistry["playback-1.0"],
  /** @deprecated Use `playback-1.5`. */
  "speed-fast": defaultIconRegistry["playback-1.5"],
  /** @deprecated Use `playback-2.0`. */
  "speed-fastest": defaultIconRegistry["playback-2.0"],
} satisfies IconRegistry;

/** Union of animation registry keys, for optionally-typed call sites. */
export type AnimationIconName = keyof typeof animationIconRegistry;

// Register these keys for build-time `<Icon name>` checking. Augmentation follows
// the dependency graph: @semio/animation (and anything depending on it) now type-
// checks icon names against `default ∪ animation`. Derived from the registry above,
// so the key set never drifts from what's actually registered.
declare module "@semio/ui" {
  interface IconRegistryKeys extends Record<AnimationIconName, true> {}
}
