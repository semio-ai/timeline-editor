# @semio/animation Agent Guide

This workspace provides reusable animation timeline, gesture, and HUD components that power `@semio/studio`. Follow these guardrails alongside the root `AGENTS.md` so changes remain consistent across the monorepo.

## Quick Facts
- Entry point: `src/index.tsx` (re-exports actions, hooks, store types, fixtures).
- Bundler: `tsup` (`npm run build`) targeting ESM + CJS and emitting `.d.ts`.
- Styles: global CSS lives in `src/styles.css` and `src/theme.css`; both are marked as side effects and must stay in the `files` array.
- Documentation: architecture notes live under `docs/`; link to them from PRs rather than duplicating rationale in code.

## Workflow Checklist
- Use the `docs/README.md` file to track the current architecture status before altering gestures, selection, or store logic—many flows are staged behind feature flags. If this file does not exist at any time, please create it and keep it up to date with current architecture designs, work, and behaviors. If work requires secondary readme files to be created, they should be created within the docs folder, and be directly linked from the main readme file. Any secondary readme files should be kept up to date, along with the main readme, and additional readmes should only be created when the topic diverges significantly from existing ones. When major categories of work conclude, the existing readme files should be evaluated, pruned or consolidated if necessary, and the parent readme updated to reflect these changes.
- Keep the main and secondary readmes in `docs` updated for multi-step changes (store updates, component wiring, tests). Mention any skipped checks in your handoff.
- Run scripts from the repo root when possible (`npm run build -- --filter @semio/animation` or `turbo run build --filter=@semio/animation`) to preserve Turborepo caching.

## Development & Testing
- `npm run dev` (tsup watch) keeps builds up to date while you edit. Stop the watcher before handoff and note the command to resume.
- Unit tests live in `src/tests`. They currently use Vitest; uncomment or add suites when enabling new behaviour. Run with `npm run test` or `turbo run test --filter=@semio/animation`.
- Prefer the fixtures in `src/test-fixtures` for scenario coverage; extend them rather than crafting ad-hoc data inside tests.
- Since the three.js and react-three/fiber environment does not work well with vitest browser mode for ui testing, we should instead thoroughly test the gesture-based actions that get called from individual components, mocking the behaviors as exhaustively as possible.

## Store & Actions Guidance
- All stateful logic flows through `src/store.ts` and action modules under `src/actions`. Maintain purity: actions should only mutate Draft state passed by Immer.
- Logic for conversion, transformation, or derivation of data should occur in `src/functions`. These may be recruited as needed within components, actions, subscriptions, or in the store, where relevant.
- Subscriptions in `src/subcriptions` are specific actions that follow a common form and are configured within the store to compute new data based on changes in the store. These should be careful to avoid infinite loops by carefully constructing equality functions. Individual subscriptions may depend on the results of other subscriptions, but generally this should be balanced with the goal to avoid infinite loops, as well as long chains of dependency changes.
- Hooks in `src/hooks` should contain the specific hooks used in react components. These may and should recruit external functions when shared functionality is present, or implementation of specific functionality is better segmented into separate files for clarity.
- Any new derived data belongs in `src/functions` or `src/subscriptions`, not in components. Update `store-types.ts` alongside the store when adding fields.
- Information about types used in the library are present in `src/types`. This is broken down further into `src/types/data` and `src/types/util`, where `data` refer to core datatypes and those provided as input/output from the system. For example, animations are the main datatype, which contain references to other data like keypoints. In contrast, `util` contains types that reflect augmented data that is created temporarily or used to represent elements in the user interface, like rows in the editor.
- Since the three.js and react-three/fiber environment does not work well with vitest browser mode for ui testing, we should attempt to place as much logic in store actions that can be thoroughly tested, as opposed to spreading logic between components, hooks, and the store itself. This applies for behavior such as selection, row creation, rendering, dragging, cut/copy/paste, etc.

## Bundling & Exports
- Keep external dependencies (`react`, `three`, `@react-three/fiber`, etc.) listed in the `tsup` command to avoid bundling them into the library.
- Export new public APIs through `src/index.tsx`. If functionality is internal, place it under an `_internal` directory and avoid re-exporting.
- Validate that CSS imports remain tree-shake safe. If you introduce component-scoped styles, ensure the build still emits a single CSS asset and update the `files` allowlist if needed.

## Common Design Guidelines and Library Usage
- We make use of the `motion` library in multiple places to pass around references to values while avoiding react rerenders. These values are typically used to update values like hover markers, and are provided in hooks like `src/hooks/use-hover-spring`. Note, `motion` is the new name for `framer-motion`, and we use this instead of the `react-spring` library.
- Pay special attention to notation and documentation in files, especially types. For example, the type definition for `src/types/data/keypoint` shows that the position of a marker is described by the `stamp` number field. Crucially, this number is a value from 0 to 1, reflecting its position relative to the duration of the animation. Animations specify a duration property, and therefore a marker with stamp 0.5 from an animation with duration 3000ms would be at 1500ms.

## Documentation & Maintenance
- Update or append relevant docs when architecture changes (selection, gestures, rendering, etc.). Keep the status summaries accurate so future agents know what is feature-gated.
- Log TODOs with `TODO(semio-agent):` so follow-up work is easy to find.
- Align this file with the root guide whenever scripts or conventions change; note intentional deviations in PR descriptions.

Keeping these practices ensures `@semio/animation` stays reliable for downstream apps and agents. When uncertain, cross-reference the root `AGENTS.md` and existing docs before diverging.