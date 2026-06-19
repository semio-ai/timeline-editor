import { type IconRegistry } from "@semio/ui";
// @semio/ui glyphs re-used as semantic aliases (these components are already in the
// default registry under other keys; we alias them to animation-domain names).
import { Angle, Slow, Fast } from "@semio/ui";
// Solar — the preferred icon set for the animation editor (see workflow note below).
import { Play, Pause } from "@solar-icons/react-perf/Bold";
import {
  TrashBinTrash,
  Copy,
  Clipboard,
  Ruler,
  Repeat,
  ArrowRight,
  RewindForward,
  Palette2,
} from "@solar-icons/react-perf/LineDuotone";
import { Scissors, AlignHorizontalCenter, Settings, Bolt } from "@solar-icons/react-perf/Linear";
// Tabler — for concepts Solar doesn't (yet) cover. Migrate to Solar as it gains them.
import {
  IconPlus,
  IconChartScatter,
  IconChartScatter3d,
  IconRotate360,
  IconPalette,
  IconPercentage,
  IconHash,
  IconFolder,
  IconPlayerSkipBack,
  IconPlayerSkipForward,
  IconClock,
  IconDotsVertical,
  IconEdit,
  IconAlertTriangle,
  IconArrowsHorizontal,
} from "@tabler/icons-react";

/**
 * Animation's icon registry — the icons `@semio/animation` needs beyond `@semio/ui`'s
 * `defaultIconRegistry`. Keys are **semantic** (named for their role, not the glyph),
 * so a glyph can be swapped here without touching call sites.
 *
 * This is a library registry: it is an exported **object**, not a provider. The
 * consuming app composes it (`{ ...animationIconRegistry, ...appRegistry }`) under one
 * `<IconProvider>`, so the app keeps final say on overrides. Curve/vector/vertex/eye/
 * lock/player glyphs already live in `defaultIconRegistry` — reference those keys
 * directly (e.g. `vector-sine`, `vertex-paired`); they are intentionally NOT duplicated
 * here.
 *
 * ## How to add an icon (the workflow — there is no codegen for this)
 * 1. Pick a **semantic key** (role/concept, kebab-case): `delete`, `unit-radian`,
 *    `data-vector2`. Not the glyph name.
 * 2. Import the component (prefer Solar; fall back to Tabler/`@semio/ui` if Solar
 *    lacks it) and add `"<key>": Component` below, in the right section.
 * 3. Use it: `<Icon name="<key>" />` (or `leftIcon="<key>"`). No import at the call site.
 * The `icon-registry.test.ts` resolve-check verifies every key a component references
 * actually exists here — run the tests after adding keys.
 *
 * Direction: we are standardizing on **Solar** across animation + studio; Tabler entries
 * are interim until Solar covers them.
 */
export const animationIconRegistry: IconRegistry = {
  // ── Editor actions (Solar canonical — converged from mixed Tabler/Solar usage) ──
  add: IconPlus, // REVIEW: Solar candidate later
  delete: TrashBinTrash,
  copy: Copy,
  paste: Clipboard,
  cut: Scissors,
  settings: Settings,
  edit: IconEdit, // REVIEW: no Solar Pen imported yet — Tabler for now
  menu: IconDotsVertical, // overflow menu; REVIEW: Solar candidate later

  // ── Transport / playback ──
  "playback-play": Play,
  "playback-pause": Pause,
  "playback-skip-back": IconPlayerSkipBack, // REVIEW: Solar candidate later
  "playback-skip-forward": IconPlayerSkipForward, // REVIEW: Solar candidate later
  "playback-loop": Repeat,
  "playback-direction": ArrowRight, // call site flips with `-scale-100` for reverse

  // ── Speed levels (glyphs are somewhat decorative; REVIEW names/glyphs) ──
  "speed-slow": Slow, // alias → default `slow`
  "speed-normal": Play,
  "speed-fast": RewindForward,
  "speed-fastest": Fast, // alias → default `fast`

  // ── Animatable data types (DataIcon) — discrete keys; some share a glyph today ──
  "data-vector2": IconChartScatter,
  "data-vector3": IconChartScatter3d,
  "data-euler": IconRotate360,
  "data-rgb": IconPalette,
  "data-hsl": IconPalette, // discrete; shares the palette glyph for now
  "data-group": IconFolder,
  "data-number": IconHash,
  "data-text": IconHash, // discrete; shares the hash glyph
  "data-binary": IconHash, // discrete; shares the hash glyph
  "data-none": IconHash, // discrete; shares the hash glyph

  // ── Value units — discrete keys, currently sharing the angle/length glyph ──
  "unit-radian": Angle,
  "unit-degree": Angle,
  "unit-meter": Ruler,
  "unit-millimeter": Ruler,
  "unit-centimeter": Ruler,
  "unit-kilometer": Ruler,
  "unit-percent": IconPercentage,

  // ── Transition affordances ──
  "transition-snap": Bolt, // instantaneous/snappy transition
  "align-keys": AlignHorizontalCenter, // REVIEW: also used as a key-toolbar option

  // ── Misc ──
  "color-picker": Palette2,
  alert: IconAlertTriangle,
  clock: IconClock,
  "fit-horizontal": IconArrowsHorizontal,
};

/** Union of animation registry keys, for optionally-typed call sites. */
export type AnimationIconName = keyof typeof animationIconRegistry;
