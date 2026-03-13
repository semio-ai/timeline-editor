# Selection Tests

Selection-focused tests for the animation store and derived row interactions.

## Files

- `basic-selection.test.ts`: single-select and clear-selection behavior.
- `modifier-selection.test.ts`: Shift/Ctrl/Cmd multi-select behavior.
- `global-track-selection.test.ts`: global row vs track row selection interactions.
- `click-marker-action.test.ts`: `clickMarker` action behavior through the store.
- `line-click-selection.test.ts`: line-segment click selection behavior.
- `visual-selection.test.ts`: selection rendering-state expectations.
- `selection-test-helpers.ts`: shared helpers and fixtures for these suites.

## Running

From repo root:

```sh
npx turbo run test --filter=@semio/animation -- --watch=false selection
```

From `packages/animation/`:

```sh
npm run test -- selection
```

## Notes

- These tests use shared fixtures from `packages/animation/src/test-fixtures/`.
- Keep this file aligned with the actual files in this directory when tests are added/removed.
