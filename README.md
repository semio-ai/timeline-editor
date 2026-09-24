# @semio/animation

Higher-level visualization and editing components for animating assets — a
canvas-based timeline editor (`AnimationSheet`) plus the track/keyframe controls
and motion primitives it's built from. Rendered with
[react-three-fiber](https://docs.pmnd.rs/react-three-fiber), themed with
[`@semio/ui`](https://www.npmjs.com/package/@semio/ui), and driven by the player
and runtime values stores in
[`@semio/utils`](https://www.npmjs.com/package/@semio/utils).

## Installation

```bash
npm install @semio/animation
```

Brings `@semio/ui` and `@semio/utils`
along as dependencies.

## Usage

```tsx
import { AnimationSheet } from "@semio/animation";

export function Editor() {
  return <AnimationSheet /* viewId, theme, fonts, … */ />;
}
```

Playback and viewport are decoupled: pan / zoom / playhead-follow are driven by
motion values independent of the player tick, so the timeline follows the
playhead smoothly without re-rendering the React tree on every frame.

## What's inside

All re-exported from the package root:

- **`AnimationSheet`** / `AnimationSheetCore` — the full timeline editor (ruler,
  tracks, minimap) across three independent canvases.
- **`AnimatableControl`** / `AnimatableControlList` / `TrackControl` / `KeyStrip`
  — per-track and per-keyframe editing controls.
- **`MotionCubicBezierLine`** / `MotionCubicBezierFill` — animated curve
  primitives.
- **Hooks** — viewport, key-control, and edge-scroll helpers for composing
  custom animation UIs.

## License

MIT
