import type { DerivedSnapshot } from "../types";

/**
 * Freezes a derived snapshot's top-level object before the store publishes it.
 *
 * The store's actions are Immer recipes. When Immer finishes one, it walks
 * every unfrozen plain object in the state, looking for drafts to resolve, and
 * deep-freezes it. The snapshot is built outside Immer and nothing ever edits
 * it in a recipe, so that walk can find nothing, yet it would cover the whole
 * snapshot (every row's frames, segments and samples) on the next action
 * after each build. A frozen object is skipped with everything under it.
 *
 * Only the top level is frozen, so the snapshot's inner objects stay mutable:
 * nothing stops code from editing a row in place, and nothing may. A snapshot
 * is replaced, never edited. The test suite deep-freezes every snapshot at
 * publish (`src/tests/setup/deep-freeze-snapshots.ts`), so an edit there
 * throws in tests.
 */
export function sealDerivedSnapshot(snapshot: DerivedSnapshot): DerivedSnapshot {
  return Object.freeze(snapshot);
}
