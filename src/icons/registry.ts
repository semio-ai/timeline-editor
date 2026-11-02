import { defaultIconRegistry, createSolarIcon as solar } from "@semio/ui";
import { Pen, Settings as SolarSettings } from "@solar-icons/react-perf/LineDuotone";
import { MenuDots } from "@solar-icons/react-perf/Bold";
import { Text } from "@solar-icons/react-perf/Linear";
import { Hashtag, DangerTriangle, ClockCircle } from "@solar-icons/react-perf/LineDuotone";
import { IconPercent } from "@semio/ui";
import { type IconRegistry } from "@semio/ui";
import { IconFolderClosed } from "@semio/ui";
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
import {
  Angle,
  Bounce,
  IconBezier,
  IconDataBinary,
  IconDataVector2,
  IconDataVector3,
  IconGraphView,
  IconKey,
  IconRotate3d,
  IconTimeDisplayFrames,
  IconTimeDisplayMilliseconds,
  IconTimeDisplaySeconds,
  IconTimeDisplaySecondsFrames,
  IconTimeDisplayTicks,
  IconVectorAngled,
  IconVectorBack,
  IconVectorBezier,
  IconVectorBezierAutoClamp,
  IconVectorBezierHandles,
  IconVectorCirc,
  IconVectorCubic,
  IconVectorExpo,
  IconVectorFlat,
  IconVectorLinear,
  IconVectorQuad,
  IconVectorQuart,
  IconVectorQuint,
  IconVectorSine,
  IconVertexFree,
  IconVertexIndeterminate,
  IconVertexPaired,
  IconVerticalNormalize,
  IconVerticalUniform,
  MovePlayerEndBounds,
  MovePlayhead,
  Playback01x,
  Playback05x,
  Playback10x,
  Playback15x,
  Playback20x,
  PlayerEndBounds,
} from "./glyphs";
import { MovePlayerStartBounds, PlaybackSeekStartBounds } from "./boundary-glyphs";

/**
 * Animation owns timeline glyphs, editor actions, playback, data types, and units.
 * Shared UI keys are inherited. Studio inherits these decisions without redeclaring them.
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
  angle: Angle,
  bezier: IconBezier,
  bounce: Bounce,
  "data-binary": IconDataBinary,
  "data-vector2": IconDataVector2,
  "data-vector3": IconDataVector3,
  "graph-view": IconGraphView,
  key: IconKey,
  "move-player-end-bounds": MovePlayerEndBounds,
  "move-playhead": MovePlayhead,
  "playback-0.1": Playback01x,
  "playback-0.5": Playback05x,
  "playback-1.0": Playback10x,
  "playback-1.5": Playback15x,
  "playback-2.0": Playback20x,
  "player-end-bounds": PlayerEndBounds,
  "rotate-3d": IconRotate3d,
  "time-display-frames": IconTimeDisplayFrames,
  "time-display-milliseconds": IconTimeDisplayMilliseconds,
  "time-display-seconds": IconTimeDisplaySeconds,
  "time-display-seconds-frames": IconTimeDisplaySecondsFrames,
  "time-display-ticks": IconTimeDisplayTicks,
  "vector-angled": IconVectorAngled,
  "vector-back": IconVectorBack,
  "vector-bezier": IconVectorBezier,
  "vector-bezier-auto-clamp": IconVectorBezierAutoClamp,
  "vector-bezier-handles": IconVectorBezierHandles,
  "vector-circ": IconVectorCirc,
  "vector-cubic": IconVectorCubic,
  "vector-expo": IconVectorExpo,
  "vector-flat": IconVectorFlat,
  "vector-linear": IconVectorLinear,
  "vector-quad": IconVectorQuad,
  "vector-quart": IconVectorQuart,
  "vector-quint": IconVectorQuint,
  "vector-sine": IconVectorSine,
  "vertex-free": IconVertexFree,
  "vertex-indeterminate": IconVertexIndeterminate,
  "vertex-paired": IconVertexPaired,
  "vertical-normalize": IconVerticalNormalize,
  "vertical-uniform": IconVerticalUniform,

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
  "menu-view": defaultIconRegistry.show,
  "time-display": IconTimeDisplaySeconds,
  "playback-bounce": Bounce,
  "view-keys": IconVectorFlat,
  "view-transitions": IconVectorAngled,
  "view-preview": IconVectorBezier,
  "view-spline": IconVectorBezierHandles,
  "view-data": IconGraphView,
  "transition-bezier-handles": IconVectorBezierHandles,
  "transition-auto-clamped": IconVectorBezierAutoClamp,
  "move-player-start-bounds": MovePlayerStartBounds,
  "playback-seek-start-bounds": PlaybackSeekStartBounds,
  "playback-seek-end-bounds": PlayerEndBounds,
  "transition-back": IconVectorBack,
  "transition-circular": IconVectorCirc,
  "transition-cubic": IconVectorCubic,
  "transition-exponential": IconVectorExpo,
  "transition-linear": IconVectorLinear,
  "transition-quadratic": IconVectorQuad,
  "transition-quartic": IconVectorQuart,
  "transition-quintic": IconVectorQuint,
  "transition-sine": IconVectorSine,
  /** @deprecated Use `playback-0.5`. */
  "speed-slow": Playback05x,
  /** @deprecated Use `playback-1.0`. */
  "speed-normal": Playback10x,
  /** @deprecated Use `playback-1.5`. */
  "speed-fast": Playback15x,
  /** @deprecated Use `playback-2.0`. */
  "speed-fastest": Playback20x,
} satisfies IconRegistry;

/** Union of animation registry keys, for optionally-typed call sites. */
export type AnimationIconName = keyof typeof animationIconRegistry;

// Register these keys for build-time `<Icon name>` checking. Augmentation follows
// the dependency graph: @semio/timeline-editor (and anything depending on it) now type-
// checks icon names against `default ∪ animation`. Derived from the registry above,
// so the key set never drifts from what's actually registered.
declare module "@semio/ui" {
  interface IconRegistryKeys extends Record<AnimationIconName, true> {}
}
