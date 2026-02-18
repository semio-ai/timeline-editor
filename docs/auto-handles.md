# Auto / Inferred Handle Resolution Plan

## Context

This document defines how Semio should support Blender-like automatic handle behavior while staying compatible with the current transition model:

- Stored keypoint transitions currently support:
  - named easing (`StandardTransitionType`)
  - explicit handle deltas (`RawVector2`)
  - optional pairing (`TransitionPairing`)
- Rendering already distinguishes raw handles and effective clamped handles.
- Current insertion supports two modes (`flat` and de Casteljau split), and key toolbar defaults are being expanded.

The goal is to add inferred/auto behavior as a first-class authored transition mode, while keeping the current explicit/easing behavior intact.

## Core Principles

1. Keep authored intent separate from computed geometry.
2. Resolve transitions in one dedicated derivation pipeline used by both rendering and interpolation.
3. Make clamping an explicit step after raw handle generation.
4. Preserve backward compatibility with existing key data and tests.

## Proposed Transition Layers

### 1) Authored Transition Spec

Authored values are what users (or defaults) select.

- `StandardTransitionType` (sine/cubic/etc)
- `RawVector2` (explicit handle)
- `TransitionDirective.ExplicitHandles`
- `TransitionDirective.InferredAutoClamped` (defined now, fully implemented later)

Note: directives are intent values; they do not directly represent a final control point.

### 2) Resolved Raw Handle

A resolver converts authored values to anchor-relative raw handle deltas (`RawVector2`) for a concrete segment context.

- Easing -> `resolveTransitionDelta(...)`
- Explicit vector -> passthrough
- `ExplicitHandles` -> infer from neighbor geometry (or de Casteljau insertion result)
- `InferredAutoClamped` -> infer from neighbor geometry (same raw generation as inferred/auto)

### 3) Effective Handle (Clamped)

A clamp stage transforms raw handles to effective handles for rendering/sampling stability.

- Existing monotonic-x clamp is retained.
- Later, `InferredAutoClamped` adds additional overshoot / direction-change limits.

## Inferred / Auto Handle Math

For key `Pi` with neighbors `P(i-1)` and `P(i+1)` in graph space `(x=time, y=value)`:

1. `dPrev = Pi - P(i-1)`, `dNext = P(i+1) - Pi`
2. Normalize: `uPrev = dPrev / |dPrev|`, `uNext = dNext / |dNext|`
3. Tangent accumulator: `d = uPrev + uNext`
4. Clamp side influence:
   - `lPrev' = min(lPrev, 5 * lNext)`
   - `lNext' = min(lNext, 5 * lPrev)`
5. With `k ~= 2.5614`, `L = |d| * k`
6. If `L != 0`:
   - left handle:  `HL = Pi - d * (lPrev' / L)`
   - right handle: `HR = Pi + d * (lNext' / L)`

These become anchor-relative deltas for storage/derivation.

## Compatibility with Current Flow

### Current capabilities to surface first

- Default new-key settings for:
  - incoming transition
  - outgoing transition
  - pairing
- Selected-key editing for:
  - incoming transition
  - outgoing transition
  - unified transition type
  - pairing

### Immediate fallback behavior

Until inferred/auto-clamped is fully implemented:

- If `TransitionDirective.InferredAutoClamped` is selected, resolve to `StandardTransitionType.Cubic`.
- This fallback applies in insertion and selected-key updates.

### Existing insertion behavior compatibility

- If defaults request explicit handles, try de Casteljau split first.
- If no valid split/segment, fall back to cubic-based handle generation.

## Dedicated Resolution Pipeline (Target Architecture)

Introduce a dedicated transition resolver used by:

1. row derivation/rendering
2. track interpolator construction
3. insertion (when computing default transitions)

Resolver inputs:

- track keypoints (local neighborhood)
- authored transition spec
- side (`in`/`out`)
- optional mode flags (`auto`, `auto-clamped`)

Resolver outputs:

- raw transition (`RawVector2` or easing fallback)
- source metadata (`explicit`, `easing`, `inferred`, `fallback`)
- clamp flags (from effective stage)

This prevents render/playback divergence.

## Editing Semantics for Future Auto Modes

When a key side is authored as inferred/auto:

- Dragging the key recomputes handles from neighbors each derivation tick.
- Dragging a handle should promote that side to explicit `RawVector2` (opt-out from auto on that side).

This mirrors common DCC behavior and keeps edits deterministic.

## Tracking

This section tracks rollout in discrete blocks. Each block includes intended unit tests.

### Block 0: Preference + UI wiring (current block)

Status: Completed

Scope:

- Add structured new-key defaults (incoming/outgoing/pairing) in preferences.
- Keep legacy insertion preference compatibility.
- Wire key toolbar to:
  - edit selected keys
  - edit defaults when no selection
  - read mixed states for selection
- Define `InferredAutoClamped` in types.
- Fallback to cubic when `InferredAutoClamped` is selected.

Tests:

- `insert-keypoint` uses defaults and keeps old compatibility path.
- selected-key toolbar updates write transitions/pairing to correct key IDs.
- mixed-state selection reads do not collapse to an arbitrary non-mixed value.

### Block 1: Central transition resolver

Status: Completed

Scope:

- Create a shared resolver module for authored -> raw transitions.
- Use it in:
  - row derivation
  - interpolation path
  - insertion default resolution

Tests:

- same authored transitions produce same sampled curves across render/interpolator paths.
- resolver parity tests for enum vs explicit vs directive inputs.

### Block 2: Inferred Auto (non-clamped)

Status: Completed

Scope:

- Implement inferred raw-handle computation from neighbors.
- Enable `ExplicitHandles` to use inferred fallback in non-split contexts.
- Optionally allow `InferredAutoClamped` to map to inferred auto first (before clamp-specific logic).

Tests:

- key y-drag changes inferred handle direction/length as expected.
- symmetric neighborhoods produce symmetric handles.
- degenerate neighborhoods (missing neighbor / zero span) fall back safely.

Implementation steps:

1. Add a dedicated raw-handle inference helper (`infer-auto-handles.ts`) with Blender-style scaling and neighbor-asymmetry clamp.
2. Route explicit-handle fallback paths through inferred auto first, then fallback to cubic if inference is unavailable.
3. Add focused unit tests for:
   - inference math behavior
   - explicit fallback integration in insertion
   - preservation of existing sloped split behavior.

### Block 3: Auto-clamped constraints

Status: In Progress

Scope:

- Add overshoot/direction-change constraints beyond monotonic x constraints.
- Apply only when authored mode is `InferredAutoClamped`.

Tests:

- monotonic source neighborhoods do not introduce interior extrema.
- local extrema neighborhoods preserve intended turning behavior at keyframes.
- clamp flags emitted for diagnostics when constraints modify raw handles.

Implementation steps:

1. Resolve authored directives (`ExplicitHandles`, `InferredAutoClamped`) to raw transitions at segment-derivation time using local neighborhood context.
2. Keep monotonic-x clamp as the baseline effective-handle limiter.
3. Add inferred-auto-clamped effective-value range shortening (endpoint-range bound) after monotonic clamp and propagate clamp flags.
4. Add local-extrema tangent flattening (horizontal at turning keys) for inferred-auto-clamped sides.
5. Follow with additional direction-change clamp logic once desired extrema behavior is specified.

### Block 4: UX polish + migration behavior

Status: Planned

Scope:

- Expose inferred/auto-clamped options in UI (when behavior is complete).
- Add migration/default behavior for existing projects.
- Document handle promotion semantics (auto -> explicit on direct handle drag).

Tests:

- serialized projects round-trip authored modes correctly.
- direct handle drag on auto key promotes side to explicit and remains stable after commit.

## Open Questions

1. Should auto mode be per-side, per-key, or only per-default profile at first?
2. Should pairing remain independent in auto mode, or be derived implicitly from inferred tangent geometry?
3. Should auto-clamped constraints run in world space, local normalized space, or both (for robust timescale/offset behavior)?
